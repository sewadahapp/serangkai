import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 3520 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookie, artifact

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-share-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  let healthy = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  if (!healthy) throw new Error('Server did not become healthy before the share test')
  cookie = (await login(base)).cookie
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
  // Flip the last hex digit to a guaranteed-different value. Blindly setting it
  // to "0" is a no-op when the signature already ends in 0, which made this
  // assertion flaky.
  const lastDigit = share.url.at(-1)
  const tampered = share.url.slice(0, -1) + (lastDigit === '0' ? '1' : '0')
  assert.equal((await fetch(tampered)).status, 404)
})

test('unlisted downloads require the capability key, and read-only tokens cannot mint one', async () => {
  // Knowing the opaque artifact id is not authorization for an unlisted file.
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/download`)).status, 404)

  const link = await fetch(`${base}/api/artifacts/${artifact.id}/share`, { method: 'POST', headers: { cookie } })
  const share = await link.json()
  const key = new URL(share.url).searchParams.get('k')
  const downloaded = await fetch(`${base}/api/artifacts/${artifact.id}/download?k=${encodeURIComponent(key)}`)
  assert.equal(downloaded.status, 200)
  assert.match(await downloaded.text(), /Secret link/)

  // A read-only agent can read but must not create a public entry point.
  const tokenResponse = await fetch(`${base}/api/tokens`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'read-only-share', scopes: ['read'] }),
  })
  const { token } = await tokenResponse.json()
  const denied = await fetch(`${base}/api/artifacts/${artifact.id}/share`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
  assert.equal(denied.status, 403)
})

test('HTML shares get the opt-in chart runtime without widening the CSP', async () => {
  const create = (content) => fetch(`${base}/api/artifacts`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Runtime share', type: 'html', content, visibility: 'public' }),
  })

  const content = '<!doctype html><html><head><title>Runtime</title></head><body>'
    + '<pre class="mermaid">flowchart LR\nA-->B</pre>'
    + '<script type="application/json" data-serangkai-chart>{"type":"bar","data":[{"label":"A","value":1}]}</script>'
    + '</body></html>'
  const created = await create(content)
  const runtimeArtifact = (await created.json()).artifact
  const response = await fetch(`${base}/api/share/${runtimeArtifact.slug}`)
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(response.headers.get('content-security-policy'), /script-src 'self' 'unsafe-inline'/)
  assert.match(html, /data-serangkai-runtime src="\/runtime\/charts\.js"/)
  assert.match(html, /data-serangkai-runtime src="\/runtime\/mermaid\.js"/)
  assert.match(html, /data-serangkai-runtime>/)

  const plain = await create('<!doctype html><html><body><p>Just HTML</p></body></html>')
  const plainArtifact = (await plain.json()).artifact
  const plainResponse = await fetch(`${base}/api/share/${plainArtifact.slug}`)
  const plainHtml = await plainResponse.text()
  assert.doesNotMatch(plainHtml, /data-serangkai-runtime/)
})

test('the workspace list exposes preview URLs only for shared artifacts', async () => {
  const create = async (title, visibility) => {
    const response = await fetch(`${base}/api/artifacts`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title, type: 'markdown', content: `# ${title}`, visibility }),
    })
    return (await response.json()).artifact
  }

  const privateArtifact = await create('Private preview', 'private')
  const publicArtifact = await create('Public preview', 'public')

  const list = await (await fetch(`${base}/api/artifacts`, { headers: { cookie } })).json()
  const unlistedRow = list.artifacts.find(item => item.id === artifact.id)
  const privateRow = list.artifacts.find(item => item.id === privateArtifact.id)
  const publicRow = list.artifacts.find(item => item.id === publicArtifact.id)

  assert.match(unlistedRow.shareUrl, /\/share\/[^?]+\?k=[a-f0-9]{64}$/)
  assert.equal(privateRow.shareUrl, null)
  assert.match(publicRow.shareUrl, /\/share\/[^?]+$/)
  assert.doesNotMatch(publicRow.shareUrl, /\?k=/)

  const privateShare = await fetch(`${base}/api/artifacts/${privateArtifact.id}/share`, {
    method: 'POST',
    headers: { cookie },
  })
  assert.equal(privateShare.status, 400)
})
