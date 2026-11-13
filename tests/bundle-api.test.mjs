import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { ZipFile } from 'yazl'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 3820 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookie

function zip(entries) {
  return new Promise((resolve, reject) => { const archive = new ZipFile(); const chunks = []; archive.outputStream.on('data', chunk => chunks.push(chunk)); archive.outputStream.on('end', () => resolve(Buffer.concat(chunks))); archive.outputStream.on('error', reject); for (const [name, content] of entries) archive.addBuffer(Buffer.from(content), name); archive.end() })
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-bundle-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  cookie = (await login(base)).cookie
})
after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('uploads and serves a public static bundle safely', async () => {
  const form = new FormData(); form.append('file', new Blob([await zip([['index.html', '<h1>Bundle</h1>'], ['assets/app.js', 'console.log(1)']])], { type: 'application/zip' }), 'site.zip'); form.append('title', 'Static site'); form.append('visibility', 'public')
  const upload = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie }, body: form }); const body = await upload.json(); assert.equal(upload.status, 200); assert.equal(body.rangka.type, 'bundle')
  const page = await fetch(`${base}/api/share/${body.rangka.slug}/index.html`); assert.equal(page.status, 200); assert.match(await page.text(), /Bundle/); assert.match(page.headers.get('content-security-policy'), /sandbox allow-scripts/)
  const script = await fetch(`${base}/api/share/${body.rangka.slug}/assets/app.js`); assert.equal(script.status, 200); assert.equal(await script.text(), 'console.log(1)')
  assert.equal((await fetch(`${base}/api/share/${body.rangka.slug}/..%2Fcontent`)).status, 404)
})

test('a colon-separated path cannot escape the bundle', async () => {
  const secret = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Private note', type: 'markdown', content: 'TOP SECRET' }) })
  const privateId = (await secret.json()).rangka.id
  const form = new FormData(); form.append('file', new Blob([await zip([['index.html', '<h1>Bundle</h1>']])], { type: 'application/zip' }), 'site.zip'); form.append('title', 'Escape probe'); form.append('visibility', 'public')
  const bundle = (await (await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie }, body: form })).json()).rangka
  // Storage treats `:` like `/`, so this would name <owner>/<privateId>/content.
  const probe = await fetch(`${base}/api/share/${bundle.slug}/..:..:${privateId}:content`)
  assert.equal(probe.status, 404)
  assert.doesNotMatch(await probe.text(), /TOP SECRET/)
})

test('rejects archive entries whose names contain a storage separator', async () => {
  const form = new FormData(); form.append('file', new Blob([await zip([['index.html', 'ok'], ['..:..:victim:content', 'overwrite']])], { type: 'application/zip' }), 'evil.zip')
  const response = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie }, body: form })
  assert.equal(response.status, 400)
  assert.match(await response.text(), /unsafe path/)
})

test('rejects malformed archives before extraction', async () => {
  const form = new FormData(); form.append('file', new Blob([Buffer.from('not a zip')], { type: 'application/zip' }), 'bad.zip')
  const response = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie }, body: form }); assert.equal(response.status, 400); assert.match(await response.text(), /zip|central directory/i)
})
