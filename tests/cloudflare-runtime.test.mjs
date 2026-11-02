import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { test, before, after } from 'node:test'

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
  child = spawn('npx', ['wrangler', 'dev', '.output/server/index.mjs', '--assets', '.output/public', '--local', '--port', String(port), '--show-interactive-dev-session=false'], { cwd: process.cwd(), env: { ...process.env, JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex') }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  child.stdout.on('data', chunk => { stderr += chunk.toString() })
  child.stderr.on('data', chunk => { stderr += chunk.toString() })
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return } catch {} await new Promise(resolve => setTimeout(resolve, 200)) }
  throw new Error(`Wrangler local Worker did not start\n${stderr}`)
})

after(async () => { await stopChild(); await rm('.wrangler', { recursive: true, force: true }) })

test('Cloudflare local D1 runtime supports registration, artifact creation, and listing', async () => {
  const email = `d1-${randomBytes(3).toString('hex')}@example.com`
  const registered = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct horse battery' }) })
  assert.equal(registered.status, 200, `${await registered.text()}\n${stderr}`)
  const cookie = registered.headers.get('set-cookie')
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'D1 runtime artifact', type: 'markdown', content: '# D1' }) })
  assert.equal(created.status, 200, await created.text())
  const listed = await fetch(`${base}/api/artifacts`, { headers: { cookie } })
  assert.equal(listed.status, 200)
  assert.equal((await listed.json()).artifacts[0].title, 'D1 runtime artifact')

  const tokenResponse = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Edge agent', scopes: ['read'] }) })
  if (tokenResponse.status !== 200) assert.fail(await tokenResponse.text())
  const { token } = await tokenResponse.json()
  const bearerListed = await fetch(`${base}/api/artifacts`, { headers: { authorization: `Bearer ${token}` } })
  assert.equal(bearerListed.status, 200)
  assert.equal((await bearerListed.json()).artifacts[0].title, 'D1 runtime artifact')
})
