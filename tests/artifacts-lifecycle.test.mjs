import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { ZipFile } from 'yazl'

const port = 3860 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookieA, cookieB, userIdA

function zip(entries) {
  return new Promise((resolve, reject) => { const archive = new ZipFile(); const chunks = []; archive.outputStream.on('data', chunk => chunks.push(chunk)); archive.outputStream.on('end', () => resolve(Buffer.concat(chunks))); archive.outputStream.on('error', reject); for (const [name, content] of entries) archive.addBuffer(Buffer.from(content), name); archive.end() })
}

async function filesUnder(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]))
    return nested.flat()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

const register = async (prefix) => {
  const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${prefix}-${randomBytes(3).toString('hex')}@example.com`, password: 'correct horse battery' }) })
  assert.equal(response.status, 200)
  return { cookie: response.headers.get('set-cookie'), user: (await response.json()).user }
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-lifecycle-test-'))
  child = spawn('node', ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  let healthy = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  if (!healthy) throw new Error('Server did not become healthy before the lifecycle test')
  const a = await register('lifecycle-a')
  cookieA = a.cookie
  userIdA = a.user.id
  cookieB = (await register('lifecycle-b')).cookie
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('deletes an artifact, its versions, and its stored files', async () => {
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Disposable', type: 'markdown', content: '# One' }) })
  const artifact = (await created.json()).artifact
  const updated = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ content: '# Two' }) })
  assert.equal(updated.status, 200)

  const stored = await filesUnder(join(dataDir, 'files', userIdA, artifact.id))
  assert.ok(stored.length >= 2, `expected content plus version files, got ${stored.length}`)

  const foreign = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'DELETE', headers: { cookie: cookieB } })
  assert.equal(foreign.status, 404)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie: cookieA } })).status, 200)

  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'DELETE', headers: { cookie: cookieA } })).status, 200)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie: cookieA } })).status, 404)
  assert.deepEqual(await filesUnder(join(dataDir, 'files', userIdA, artifact.id)), [])
})

test('deletes extracted bundle files from the storage volume', async () => {
  const form = new FormData()
  form.append('file', new Blob([await zip([['index.html', '<h1>Temp bundle</h1>']])], { type: 'application/zip' }), 'temp.zip')
  form.append('title', 'Temp bundle')
  const upload = await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie: cookieA }, body: form })
  assert.equal(upload.status, 200)
  const artifact = (await upload.json()).artifact
  const bundleDirectory = join(dataDir, 'files', userIdA, artifact.id, 'bundle')
  assert.ok((await filesUnder(bundleDirectory)).length > 0)

  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'DELETE', headers: { cookie: cookieA } })).status, 200)
  assert.deepEqual(await filesUnder(bundleDirectory), [])
})
