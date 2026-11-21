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

const uploadZip = async (entries, { visibility = 'private', title = 'Bundle' } = {}) => {
  const form = new FormData(); form.append('file', new Blob([await zip(entries)], { type: 'application/zip' }), 'site.zip'); form.append('title', title); form.append('visibility', visibility)
  return fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie }, body: form })
}

test('a zipped folder is served from inside it and OS junk is skipped', async () => {
  const upload = await uploadZip([
    ['site/index.html', '<link rel="stylesheet" href="style.css"><h1>Folder site</h1>'],
    ['site/style.css', 'h1{color:red}'],
    ['site/fonts/body.woff2', 'font'],
    ['site/docs/index.html', '<h1>Docs page</h1>'],
    ['site/site.webmanifest', '{"name":"Site"}'],
    ['site/.DS_Store', 'junk'],
    ['__MACOSX/site/._index.html', 'junk'],
  ], { visibility: 'public' })
  assert.equal(upload.status, 200)
  const { slug } = (await upload.json()).rangka
  assert.match(await (await fetch(`${base}/api/share/${slug}/index.html`)).text(), /Folder site/)
  assert.match(await (await fetch(`${base}/api/share/${slug}/docs/`)).text(), /Docs page/, 'a directory URL serves its index.html')
  const policy = (await fetch(`${base}/api/share/${slug}/index.html`)).headers.get('content-security-policy')
  assert.match(policy, /sandbox allow-scripts/)
  assert.match(policy, /style-src 'self' 'unsafe-inline'/, 'inline styles work, as in HTML rangka')
  assert.match(policy, /connect-src 'none'/)
  const css = await fetch(`${base}/api/share/${slug}/style.css`)
  assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8')
  assert.equal((await fetch(`${base}/api/share/${slug}/fonts/body.woff2`)).headers.get('content-type'), 'font/woff2')
  assert.equal((await fetch(`${base}/api/share/${slug}/site.webmanifest`)).headers.get('content-type'), 'application/manifest+json')
  assert.equal((await fetch(`${base}/api/share/${slug}/.DS_Store`)).status, 404)
})

test('a zip without an index.html, or with files that are not web files, is refused', async () => {
  const noIndex = await uploadZip([['photos/one.png', 'png'], ['photos/two.png', 'png']])
  assert.equal(noIndex.status, 400)
  assert.match((await noIndex.json()).message, /index\.html/)

  const twoFolders = await uploadZip([['a/index.html', 'a'], ['b/index.html', 'b']])
  assert.equal(twoFolders.status, 400, 'only a single top-level folder is unwrapped')

  const binaries = await uploadZip([['index.html', 'ok'], ['setup.exe', 'MZ'], ['tools/run.sh', 'echo'], ['notes.docx', 'x']])
  assert.equal(binaries.status, 400)
  const { message } = await binaries.json()
  assert.match(message, /setup\.exe/)
  assert.match(message, /tools\/run\.sh/)
  assert.match(message, /notes\.docx/)
  const listed = await (await fetch(`${base}/api/workspace`, { headers: { cookie } })).json()
  assert.equal(listed.rangka.some(item => item.title === 'Bundle' && item.type === 'bundle' && item.visibility === 'private'), false, 'refused uploads create nothing')
})

test('private and unlisted bundles carry their access key in the path so relative assets load', async () => {
  const entries = [['index.html', '<link rel="stylesheet" href="style.css"><h1>Keyed</h1>'], ['style.css', 'h1{color:red}']]

  const priv = (await (await uploadZip(entries, { title: 'Private site' })).json()).rangka
  // No cookie: the sandboxed frame sends none.
  assert.equal((await fetch(`${base}/api/share/${priv.slug}/style.css`)).status, 401)
  const { bundleUrl } = await (await fetch(`${base}/api/rangka/${priv.id}`, { headers: { cookie } })).json()
  assert.match(bundleUrl, new RegExp(`^/api/share/${priv.slug}/~\\d+-[a-f0-9]{64}/index\\.html$`))
  assert.match(await (await fetch(`${base}${bundleUrl}`)).text(), /Keyed/)
  const asset = await fetch(`${base}${bundleUrl.replace('index.html', 'style.css')}`)
  assert.equal(asset.status, 200)
  assert.equal(asset.headers.get('referrer-policy'), 'no-referrer')
  // A key for one bundle does not open another, and a forged key fails.
  const other = (await (await uploadZip(entries, { title: 'Other private site' })).json()).rangka
  const key = bundleUrl.split('/')[4]
  assert.equal((await fetch(`${base}/api/share/${other.slug}/${key}/index.html`)).status, 401)
  assert.equal((await fetch(`${base}/api/share/${priv.slug}/~1-${'0'.repeat(64)}/index.html`)).status, 401)

  // API tokens get no view key; they read through their own bearer auth.
  const token = (await (await fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'reader', scopes: ['read'] }) })).json()).token
  assert.equal((await (await fetch(`${base}/api/rangka/${priv.id}`, { headers: { authorization: `Bearer ${token}` } })).json()).bundleUrl, null)

  const unlisted = (await (await uploadZip(entries, { visibility: 'unlisted', title: 'Unlisted site' })).json()).rangka
  const share = await (await fetch(`${base}/api/rangka/${unlisted.id}/share`, { method: 'POST', headers: { cookie } })).json()
  const shareKey = new URL(share.url).searchParams.get('k')
  const reader = await (await fetch(`${base}/api/share/${unlisted.slug}?format=json&k=${shareKey}`)).json()
  assert.equal(reader.rawUrl, `/api/share/${unlisted.slug}/~${shareKey}/index.html`)
  assert.equal((await fetch(`${base}/api/share/${unlisted.slug}/~${shareKey}/style.css`)).status, 200)
  assert.equal((await fetch(`${base}/api/share/${unlisted.slug}/style.css`)).status, 404)
})

test('duplicating a bundle gives the copy its own files', async () => {
  const source = (await (await uploadZip([['index.html', '<h1>Original</h1>']], { title: 'Copy source' })).json()).rangka
  const copy = (await (await fetch(`${base}/api/rangka/${source.id}/duplicate`, { method: 'POST', headers: { cookie } })).json()).rangka
  const { bundleUrl } = await (await fetch(`${base}/api/rangka/${copy.id}`, { headers: { cookie } })).json()
  assert.match(await (await fetch(`${base}${bundleUrl}`)).text(), /Original/)
  // Deleting the source leaves the copy intact.
  assert.equal((await fetch(`${base}/api/rangka/${source.id}`, { method: 'DELETE', headers: { cookie } })).status, 200)
  assert.equal((await fetch(`${base}${bundleUrl}`)).status, 200)
})
