import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { test, before, after } from 'node:test'
import { adminEnv, adminPassword, adminUsername, login } from './helpers/auth.mjs'

const port = 4020 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child
let stderr = ''

function signalGroup(signal) {
  if (!child?.pid) return
  try {
    // Wrangler spawns workerd as a grandchild; signalling the process group
    // stops the whole tree instead of leaving an orphan holding the port.
    process.kill(-child.pid, signal)
  } catch {
    try { child.kill(signal) } catch {}
  }
}

async function stopChild() {
  if (!child || child.exitCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  signalGroup('SIGTERM')
  const timer = setTimeout(() => signalGroup('SIGKILL'), 5000)
  await exited
  clearTimeout(timer)
  child.stdout?.destroy()
  child.stderr?.destroy()
}

before(async () => {
  const jwtSecret = randomBytes(32).toString('hex')
  const shareSecret = randomBytes(32).toString('hex')
  child = spawn('bunx', ['wrangler', 'dev', '.output/server/index.mjs', '--assets', '.output/public', '--local', '--port', String(port), '--show-interactive-dev-session=false', '--var', `JWT_SECRET:${jwtSecret}`, '--var', `SHARE_SECRET:${shareSecret}`, '--var', `ADMIN_USERNAME:${adminUsername}`, '--var', `ADMIN_PASSWORD:${adminPassword}`, '--var', `NUXT_APP_SECRET:${process.env.NUXT_APP_SECRET}`, '--var', 'NUXT_SESSION_COOKIE_SECURE:false'], { cwd: process.cwd(), env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  child.stdout.on('data', chunk => { stderr += chunk.toString() })
  child.stderr.on('data', chunk => { stderr += chunk.toString() })
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return } catch {} await new Promise(resolve => setTimeout(resolve, 200)) }
  throw new Error(`Wrangler local Worker did not start\n${stderr}`)
})

after(async () => { await stopChild(); await rm('.wrangler', { recursive: true, force: true }) })

test('Cloudflare local D1 runtime supports owner login, artifact creation, and listing', async () => {
  const { cookie } = await login(base)
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'D1 runtime artifact', type: 'markdown', content: '# D1' }) })
  assert.equal(created.status, 200, await created.text())
  const listed = await fetch(`${base}/api/artifacts`, { headers: { cookie } })
  assert.equal(listed.status, 200)
  assert.equal((await listed.json()).artifacts[0].title, 'D1 runtime artifact')

  // Exercise the R2 binding, not just D1: upload and read back binary bytes.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png')
  form.append('title', 'CF image')
  const uploaded = await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie }, body: form })
  const uploadBody = await uploaded.text()
  assert.equal(uploaded.status, 200, uploadBody)
  const image = JSON.parse(uploadBody).artifact
  const downloaded = await fetch(`${base}/api/artifacts/${image.id}/download`, { headers: { cookie } })
  assert.equal(downloaded.status, 200)
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png)
  assert.doesNotMatch(stderr, /ephemeral memory storage/)

  const tokenResponse = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Edge agent', scopes: ['read'] }) })
  if (tokenResponse.status !== 200) assert.fail(await tokenResponse.text())
  const { token } = await tokenResponse.json()
  const bearerListed = await fetch(`${base}/api/artifacts`, { headers: { authorization: `Bearer ${token}` } })
  assert.equal(bearerListed.status, 200)
  const titles = (await bearerListed.json()).artifacts.map(artifact => artifact.title)
  assert.deepEqual(titles.sort(), ['CF image', 'D1 runtime artifact'])

  // Shiki must initialize on Workers. The full shiki bundle's Oniguruma WASM
  // fails here, so this endpoint has to use the core + JavaScript engine.
  const highlighted = await fetch(`${base}/api/highlight`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: '{"type":"http"}', lang: 'json' }),
  })
  assert.equal(highlighted.status, 200)
  const highlightedBody = await highlighted.json()
  assert.equal(highlightedBody.highlighted, true, 'syntax highlighting must work on the Workers runtime')
  assert.match(highlightedBody.html, /--shiki-light:#[0-9A-F]{3,8}/)
})
