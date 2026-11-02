import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'

const port = 3420 + Math.floor(Math.random() * 100)
const baseUrl = `http://127.0.0.1:${port}`
let child, dataDir, cookie

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-upload-test-'))
  child = spawn('node', ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${baseUrl}/api/health`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  const response = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `upload-${randomBytes(3).toString('hex')}@example.com`, password: 'correct horse battery' }) })
  assert.equal(response.ok, true)
  cookie = response.headers.get('set-cookie')
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('uploads binary-safe files and downloads them with metadata', async () => {
  const form = new FormData()
  form.append('file', new Blob([Buffer.from([0, 1, 2, 255, 254])], { type: 'application/octet-stream' }), 'sample.bin')
  form.append('title', 'Binary sample')
  const upload = await fetch(`${baseUrl}/api/artifacts/upload`, { method: 'POST', headers: { cookie }, body: form })
  const uploadBody = await upload.text()
  assert.equal(upload.ok, true, uploadBody)
  const result = JSON.parse(uploadBody)
  assert.equal(result.artifact.type, 'markdown')
  const download = await fetch(`${baseUrl}/api/artifacts/${result.artifact.id}/download`, { headers: { cookie } })
  assert.equal(download.status, 200)
  assert.equal(download.headers.get('content-disposition'), 'attachment; filename="sample.bin"')
  assert.deepEqual([...new Uint8Array(await download.arrayBuffer())], [0, 1, 2, 255, 254])
})

test('requires authentication for uploads and private downloads', async () => {
  const form = new FormData()
  form.append('file', new Blob(['secret']), 'secret.md')
  const upload = await fetch(`${baseUrl}/api/artifacts/upload`, { method: 'POST', body: form })
  assert.equal(upload.status, 401)
})
