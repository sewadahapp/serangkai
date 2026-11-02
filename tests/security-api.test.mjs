import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'

const port = 3620 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookie, htmlArtifact, markdownArtifact

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-security-test-'))
  child = spawn('node', ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  const registered = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `security-${randomBytes(3).toString('hex')}@example.com`, password: 'correct horse battery' }) })
  cookie = registered.headers.get('set-cookie')
  htmlArtifact = (await (await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Unsafe HTML', type: 'html', content: '<script>fetch(\"https://evil.example\")</script>', visibility: 'public' }) })).json()).artifact
  markdownArtifact = (await (await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: '</title><script>alert(1)</script>', type: 'markdown', content: '[bad](javascript:alert(1))', visibility: 'public' }) })).json()).artifact
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('HTML artifacts receive a restrictive sandbox CSP', async () => {
  const response = await fetch(`${base}/api/share/${htmlArtifact.slug}`)
  assert.equal(response.status, 200)
  const csp = response.headers.get('content-security-policy')
  assert.match(csp, /sandbox allow-scripts/)
  assert.match(csp, /connect-src 'none'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
})

test('Markdown output strips executable links and escapes document metadata', async () => {
  const response = await fetch(`${base}/api/share/${markdownArtifact.slug}`)
  const body = await response.text()
  assert.equal(response.status, 200)
  assert.doesNotMatch(body, /<script>alert\(1\)<\/script>/)
  assert.doesNotMatch(body, /javascript:/)
  assert.match(body, /&lt;\/title&gt;/)
})
