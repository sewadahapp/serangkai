import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import yazl from 'yazl'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 3620 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookie, htmlArtifact, markdownArtifact, pinnedArtifact

function makeZip(entries) {
  const zip = new yazl.ZipFile()
  for (const [name, content] of Object.entries(entries)) zip.addBuffer(Buffer.from(content), name)
  const chunks = []
  zip.end()
  return new Promise((resolve, reject) => {
    zip.outputStream.on('data', chunk => chunks.push(chunk))
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    zip.outputStream.on('error', reject)
  })
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-security-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  cookie = (await login(base)).cookie
  htmlArtifact = (await (await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Unsafe HTML', type: 'html', content: '<script>fetch(\"https://evil.example\")</script>', visibility: 'public' }) })).json()).artifact
  markdownArtifact = (await (await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: '</title><script>alert(1)</script>', type: 'markdown', content: '[bad](javascript:alert(1))', visibility: 'public' }) })).json()).artifact
  pinnedArtifact = (await (await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Pinned light', type: 'html', content: '<!DOCTYPE html><html><head><meta name="color-scheme" content="only light"></head><body>pinned</body></html>', visibility: 'public' }) })).json()).artifact
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('HTML artifacts receive a restrictive sandbox CSP', async () => {
  const response = await fetch(`${base}/api/share/${htmlArtifact.slug}`)
  assert.equal(response.status, 200)
  const csp = response.headers.get('content-security-policy')
  assert.match(csp, /sandbox allow-scripts/)
  assert.match(csp, /connect-src 'none'/)
  // The reader frames the artifact on the same origin; outside origins cannot.
  assert.match(csp, /frame-ancestors 'self'/)
  assert.match(csp, /form-action 'none'/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')

  // Styling is allowed for documents; script injection from other origins,
  // framing, and network exfiltration are not.
  assert.match(csp, /style-src 'self' 'unsafe-inline'/)
  assert.doesNotMatch(csp, /script-src[^;]*https:/)
  assert.doesNotMatch(csp, /connect-src (?!'none')/)
  assert.doesNotMatch(csp, /allow-same-origin/)
  assert.doesNotMatch(csp, /allow-forms/)
  assert.doesNotMatch(csp, /allow-popups/)
})

test('Markdown output strips executable links and escapes document metadata', async () => {
  const response = await fetch(`${base}/api/share/${markdownArtifact.slug}`)
  const body = await response.text()
  assert.equal(response.status, 200)
  assert.doesNotMatch(body, /<script>alert\(1\)<\/script>/)
  assert.doesNotMatch(body, /href="javascript:/i)
  assert.match(body, /&lt;\/title&gt;/)
})

test('HTML artifacts get a color-mode bridge that follows the client hint', async () => {
  const adaptive = await fetch(`${base}/api/share/${htmlArtifact.slug}`)
  const body = await adaptive.text()
  assert.match(body, /data-serangkai-color-mode/)
  assert.match(body, /serangkai:color-mode/)
  assert.match(body, /prefers-color-scheme: dark/)

  const csp = adaptive.headers.get('content-security-policy')
  assert.match(csp, /script-src 'self' 'unsafe-inline'/, 'the bridge and same-origin runtime must be allowed')
  assert.doesNotMatch(csp, /script-src[^;]*https?:/, 'remote scripts must stay blocked')
  assert.match(csp, /connect-src 'none'/, 'artifacts must not reach the network')
  assert.match(csp, /sandbox allow-scripts/)
  assert.match(csp, /style-src 'self' 'unsafe-inline'/)
  assert.doesNotMatch(csp, /allow-same-origin/)
  assert.doesNotMatch(csp, /allow-forms/)
  assert.equal(adaptive.headers.get('accept-ch'), 'Sec-CH-Prefers-Color-Scheme')
  assert.match(adaptive.headers.get('vary') || '', /Sec-CH-Prefers-Color-Scheme/)

  // The client hint bakes the mode into the first paint.
  const dark = await fetch(`${base}/api/share/${htmlArtifact.slug}`, { headers: { 'sec-ch-prefers-color-scheme': 'dark' } })
  assert.match(await dark.text(), /html\{\s*color-scheme:dark;\s*\}/)
  const light = await fetch(`${base}/api/share/${htmlArtifact.slug}`, { headers: { 'sec-ch-prefers-color-scheme': 'light' } })
  assert.match(await light.text(), /html\{\s*color-scheme:light;\s*\}/)
})

test('an artifact that pins one color scheme is delivered untouched', async () => {
  const response = await fetch(`${base}/api/share/${pinnedArtifact.slug}`, { headers: { 'sec-ch-prefers-color-scheme': 'dark' } })
  const body = await response.text()
  assert.equal(response.status, 200)
  assert.doesNotMatch(body, /data-serangkai-color-mode/, 'pinned artifacts opt out of the bridge')
  assert.match(body, /only light/)
})

test('shared images and bundle documents cannot execute scripts on the app origin', async () => {
  // An SVG is an active document, and bundle paths are only checked for a
  // lowercase `.html` suffix. Both must carry a sandbox policy when opened
  // directly at `/api/share/...`.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>document.title="x"</script></svg>'
  const imageForm = new FormData()
  imageForm.append('file', new Blob([svg], { type: 'image/svg+xml' }), 'image.svg')
  imageForm.append('title', 'svg image')
  imageForm.append('visibility', 'public')
  const uploaded = await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie }, body: imageForm })
  const image = (await uploaded.json()).artifact
  const imageResponse = await fetch(`${base}/api/share/${image.slug}`)
  assert.equal(imageResponse.status, 200)
  assert.match(imageResponse.headers.get('content-security-policy'), /sandbox/)
  assert.equal(imageResponse.headers.get('x-content-type-options'), 'nosniff')

  const zip = await makeZip({
    'index.html': '<!doctype html><html><body>ok</body></html>',
    'EVIL.HTML': '<script>document.title="x"</script>',
    'image.svg': svg,
  })
  const bundleForm = new FormData()
  bundleForm.append('file', new Blob([zip], { type: 'application/zip' }), 'bundle.zip')
  bundleForm.append('title', 'sandbox bundle')
  bundleForm.append('type', 'bundle')
  bundleForm.append('visibility', 'public')
  const bundle = (await (await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie }, body: bundleForm })).json()).artifact

  for (const path of ['EVIL.HTML', 'image.svg']) {
    const response = await fetch(`${base}/api/share/${bundle.slug}/${path}`)
    assert.equal(response.status, 200, path)
    assert.match(response.headers.get('content-security-policy') || '', /sandbox allow-scripts/, path)
  }
})

test('image metadata cannot upgrade a non-SVG artifact to an executable type', async () => {
  const created = await fetch(`${base}/api/artifacts`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'sneaky image',
      type: 'image',
      visibility: 'public',
      metadata: { mimeType: 'text/html' },
      content: '<script>document.title="x"</script>',
    }),
  })
  const artifact = (await created.json()).artifact
  const response = await fetch(`${base}/api/share/${artifact.slug}`)
  assert.equal(response.status, 200)
  assert.doesNotMatch(response.headers.get('content-type') || '', /text\/html/)
  assert.match(response.headers.get('content-security-policy') || '', /sandbox/)
})
