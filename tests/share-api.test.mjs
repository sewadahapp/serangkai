import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'

const port = 3520 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookie, artifact

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-share-test-'))
  child = spawn('node', ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `share-${randomBytes(3).toString('hex')}@example.com`, password: 'correct horse battery' }) })
  cookie = response.headers.get('set-cookie')
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Unlisted report', type: 'markdown', content: '# Secret link', visibility: 'unlisted' }) })
  artifact = (await created.json()).artifact
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('unlisted artifacts require signed links', async () => {
  assert.equal((await fetch(`${base}/api/share/${artifact.slug}`)).status, 404)
  const link = await fetch(`${base}/api/artifacts/${artifact.id}/share`, { method: 'POST', headers: { cookie } })
  assert.equal(link.status, 200)
  const share = await link.json()
  assert.match(share.url, /[?]k=[a-f0-9]{64}$/)
  const publicResponse = await fetch(share.url)
  assert.equal(publicResponse.status, 200)
  assert.match(await publicResponse.text(), /Secret link/)
  assert.equal((await fetch(`${share.url.slice(0, -1)}0`)).status, 404)
})
