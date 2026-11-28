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

test('Cloudflare local D1 runtime supports owner login, rangka creation, and listing', async () => {
  const { cookie } = await login(base)
  const created = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'D1 runtime rangka', type: 'markdown', content: '# D1' }) })
  assert.equal(created.status, 200, await created.text())
  const listed = await fetch(`${base}/api/rangka`, { headers: { cookie } })
  assert.equal(listed.status, 200)
  assert.equal((await listed.json()).rangka[0].title, 'D1 runtime rangka')

  // Exercise the R2 binding, not just D1: upload and read back binary bytes.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png')
  form.append('title', 'CF image')
  const uploaded = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie }, body: form })
  const uploadBody = await uploaded.text()
  assert.equal(uploaded.status, 200, uploadBody)
  const image = JSON.parse(uploadBody).rangka
  const downloaded = await fetch(`${base}/api/rangka/${image.id}/download`, { headers: { cookie } })
  assert.equal(downloaded.status, 200)
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png)
  assert.doesNotMatch(stderr, /ephemeral memory storage/)

  // R2 is object storage: usage is reported without a disk size, never as a
  // full zero-byte disk.
  const storageResponse = await fetch(`${base}/api/storage`, { headers: { cookie } })
  assert.equal(storageResponse.status, 200, await storageResponse.clone().text())
  const { storage } = await storageResponse.json()
  assert.ok(storage.usedBytes > 0)
  assert.equal(storage.disk, null)

  const tokenResponse = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Edge agent', scopes: ['read'] }) })
  if (tokenResponse.status !== 200) assert.fail(await tokenResponse.text())
  const { token } = await tokenResponse.json()
  const bearerListed = await fetch(`${base}/api/rangka`, { headers: { authorization: `Bearer ${token}` } })
  assert.equal(bearerListed.status, 200)
  const titles = (await bearerListed.json()).rangka.map(rangka => rangka.title)
  assert.deepEqual(titles.sort(), ['CF image', 'D1 runtime rangka'])

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

test('Cloudflare local D1 runtime keeps rangka data within its limits', async () => {
  const { cookie } = await login(base)
  const headers = { cookie, 'content-type': 'application/json' }
  const call = async (method, path, body, extra = headers) => {
    const response = await fetch(`${base}${path}`, { method, headers: extra, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json().catch(() => null) }
  }
  const created = await call('POST', '/api/rangka', { title: 'D1 board', type: 'html', content: '<!doctype html><html><head><title>Board</title></head><body></body></html>', visibility: 'public' })
  assert.equal(created.status, 200, JSON.stringify(created.body))
  const { id, slug } = created.body.rangka
  const path = `/api/rangka/${id}/data`

  // Round trip, merge, and the optional read.
  assert.equal((await call('PUT', `${path}/cards/c1`, { data: { title: 'Edge card' } })).status, 200)
  assert.deepEqual((await call('PATCH', `${path}/cards/c1`, { data: { column: 'done' } })).body.document.data, { title: 'Edge card', column: 'done' })
  assert.deepEqual((await call('GET', `${path}/cards/missing?optional=1`)).body, { document: null })
  assert.equal((await call('GET', `/api/share-data/${slug}/cards/c1`, undefined, {})).body.document.data.column, 'done')
  assert.equal((await call('PUT', `/api/share-data/${slug}/cards/c1`, { data: {} }, { 'content-type': 'application/json' })).status >= 400, true)

  // Fill close to the 5 MB per-rangka limit, then race small writes for the
  // room left. D1 queries are asynchronous, so these genuinely interleave.
  const big = { text: 'x'.repeat(63 * 1024) }
  const bigSize = Buffer.byteLength(JSON.stringify(big))
  const limit = 5 * 1024 * 1024
  const fill = Math.floor((limit - 600) / bigSize)
  for (let start = 0; start < fill; start += 10) {
    const statuses = await Promise.all(Array.from({ length: Math.min(10, fill - start) }, (_, i) => call('PUT', `${path}/blobs/b${start + i}`, { data: big }).then(r => r.status)))
    assert.ok(statuses.every(status => status === 200), `fill returned ${statuses}`)
  }
  const used = (await call('GET', path)).body.collections.reduce((sum, c) => sum + c.bytes, 0)
  const small = { text: 'y'.repeat(200) }
  const smallSize = Buffer.byteLength(JSON.stringify(small))
  const room = Math.floor((limit - used) / smallSize)
  assert.ok(room > 0 && room < 30, `expected a little room, got ${room}`)
  const raced = await Promise.all(Array.from({ length: 30 }, (_, i) => call('PUT', `${path}/race/r${i}`, { data: small })))
  assert.equal(raced.filter(r => r.status === 200).length, room)
  assert.ok(raced.filter(r => r.status !== 200).every(r => r.status === 413), JSON.stringify(raced.map(r => r.status)))
  const total = (await call('GET', path)).body.collections.reduce((sum, c) => sum + c.bytes, 0)
  assert.ok(total <= limit, `stored ${total} bytes, over the ${limit} limit`)

  // Deleting the rangka removes its data from storage accounting.
  const before = (await call('GET', '/api/storage')).body.storage.usedBytes
  assert.equal((await call('DELETE', `/api/rangka/${id}`)).status, 200)
  assert.ok((await call('GET', '/api/storage')).body.storage.usedBytes <= before - total)
})
