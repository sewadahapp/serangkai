import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 4720 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-error-pages-'))
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
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

const htmlPage = (path, headers = {}) => fetch(`${base}${path}`, {
  headers: { accept: 'text/html', ...headers },
})

test('unknown routes render the custom 404 page with a real 404 status', async () => {
  const response = await htmlPage('/definitely-not-a-page')
  assert.equal(response.status, 404)
  assert.match(response.headers.get('content-type') || '', /text\/html/)

  const body = await response.text()
  assert.match(body, /<title>This page is off the map\. · Serangkai<\/title>/)
  assert.match(body, /This page is off the map\./)
  assert.match(body, /Error 404 · Not found/)
  assert.match(body, /Error code/)
  assert.match(body, /serangkai-error-doodle/)
  assert.match(body, /name="robots" content="noindex, nofollow"/)
  assert.match(body, /Back to home/)
  assert.match(body, /New here\?/)
  assert.doesNotMatch(body, /opendoodles|cdn\.prod\.website-files\.com/)
  assert.doesNotMatch(body, /at Object\.|node_modules\/|__NUXT_ERROR/)
})

test('the 404 page offers the workspace to a signed-in owner', async () => {
  const { cookie } = await login(base)
  const response = await htmlPage('/missing/artifact', { cookie })
  assert.equal(response.status, 404)

  const body = await response.text()
  assert.match(body, /This page is off the map\./)
  assert.match(body, /Back to workspace/)
  assert.doesNotMatch(body, /New here\?/)
  assert.doesNotMatch(body, /at Object\.|node_modules\/|__NUXT_ERROR/)
})

test('unknown API-style requests still get a JSON 404', async () => {
  const response = await fetch(`${base}/definitely-not-a-page`, {
    headers: { accept: 'application/json' },
  })
  assert.equal(response.status, 404)
  assert.match(response.headers.get('content-type') || '', /application\/json/)
  const body = await response.json()
  assert.equal(body.statusCode, 404)
})
