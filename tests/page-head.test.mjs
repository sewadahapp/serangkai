import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 4860 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookie, artifact

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-head-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      ...adminEnv(),
      PORT: String(port),
      JWT_SECRET: randomBytes(32).toString('hex'),
      SHARE_SECRET: randomBytes(32).toString('hex'),
      DATABASE_PATH: join(dataDir, 'serangkai.db'),
      STORAGE_PATH: join(dataDir, 'files'),
    },
    stdio: 'ignore',
  })
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const session = await login(base)
  cookie = session.cookie
  const response = await fetch(`${base}/api/artifacts`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Head probe artifact', type: 'markdown', content: '# Hello', visibility: 'private' }),
  })
  artifact = (await response.json()).artifact
})

after(async () => {
  child?.kill('SIGTERM')
  await rm(dataDir, { recursive: true, force: true })
})

const htmlPage = (path, headers = {}) => fetch(`${base}${path}`, {
  headers: { accept: 'text/html', cookie, ...headers },
})

const headOf = (body) => body.slice(body.indexOf('<head'), body.indexOf('</head>'))
const tag = (head, pattern) => head.match(pattern)?.[0]

test('every page carries the same title suffix and icon set', async () => {
  for (const [path, expected] of [
    ['/workspace', 'Workspace · Serangkai'],
    ['/dashboard', 'Workspace · Serangkai'],
    ['/settings', 'Settings · Serangkai'],
    ['/agent', 'Connect an agent · Serangkai'],
    ['/', 'Workspace · Serangkai'],
  ]) {
    const response = await htmlPage(path)
    assert.equal(response.status, 200, path)
    const head = headOf(await response.text())
    assert.match(head, new RegExp(`<title>${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</title>`), path)
    assert.match(head, /<meta name="description" content="[^"]+"/, path)
    assert.match(head, /<link rel="icon"[^>]+favicon\.ico/, path)
    assert.match(head, /<link rel="icon"[^>]+favicon\.svg/, path)
    assert.match(head, /<link rel="apple-touch-icon"[^>]+apple-touch-icon\.png/, path)
    assert.match(head, /<link rel="manifest"[^>]+site\.webmanifest/, path)
  }
})

test('workspace and app pages keep the private indexing policy', async () => {
  for (const path of ['/', '/workspace', '/settings', '/auth/login']) {
    const head = headOf(await (await htmlPage(path)).text())
    assert.match(head, /<meta name="robots" content="noindex, nofollow">/, path)
  }
})

test('artifact titles render server-side and missing artifacts answer 404', async () => {
  const owned = await htmlPage(`/artifacts/${artifact.id}`, { cookie })
  assert.equal(owned.status, 200)
  assert.match(headOf(await owned.text()), /<title>Head probe artifact · Serangkai<\/title>/)

  const missing = await htmlPage('/artifacts/definitely-not-an-artifact', { cookie })
  assert.equal(missing.status, 404)
  const body = await missing.text()
  assert.match(body, /<title>This page is off the map\. · Serangkai<\/title>/)
  assert.match(body, /<meta name="robots" content="noindex, nofollow">/)
})

test('shared artifacts and share errors are not indexed', async () => {
  const missing = await htmlPage('/share/definitely-not-a-share')
  assert.equal(missing.status, 404)
  const body = await missing.text()
  assert.match(body, /<title>This shared artifact is off the map\. · Serangkai<\/title>/)
  assert.match(body, /<meta name="robots" content="noindex, nofollow">/)
})

test('the icon files and web manifest are served', async () => {
  for (const [path, type] of [
    ['/favicon.ico', /image\/(vnd\.microsoft\.icon|x-icon)/],
    ['/favicon.svg', /image\/svg\+xml/],
    ['/apple-touch-icon.png', /image\/png/],
    ['/icon-192.png', /image\/png/],
    ['/icon-512.png', /image\/png/],
    ['/icon-maskable-512.png', /image\/png/],
    ['/site.webmanifest', /application\/manifest\+json/],
  ]) {
    const response = await fetch(`${base}${path}`)
    assert.equal(response.status, 200, path)
    assert.match(response.headers.get('content-type') || '', type, path)
  }

  const manifest = await (await fetch(`${base}/site.webmanifest`)).json()
  assert.equal(manifest.name, 'Serangkai')
  assert.equal(manifest.start_url, '/')
  assert.ok(manifest.icons.some(icon => icon.src === '/icon-192.png' && icon.sizes === '192x192'))
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'))
})
