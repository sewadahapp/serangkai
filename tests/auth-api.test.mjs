import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, adminPassword, adminUsername, login } from './helpers/auth.mjs'

const port = 4460 + Math.floor(Math.random() * 40)
const base = `http://127.0.0.1:${port}`
let child, dataDir, sessionCookie

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-auth-api-'))
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

test('public registration is gone from both the API and the pages', async () => {
  const api = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.com', password: 'correct horse battery' }),
  })
  assert.equal(api.status, 404)
  assert.equal((await fetch(`${base}/auth/register`)).status, 404)
})

test('rejects invalid credentials and accepts the configured owner', async () => {
  const wrong = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: 'definitely wrong' }),
  })
  assert.equal(wrong.status, 401)

  const unknown = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'nobody', password: adminPassword }),
  })
  assert.equal(unknown.status, 401)

  const ok = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  })
  assert.equal(ok.status, 200)
  sessionCookie = ok.headers.get('set-cookie')
  assert.ok(sessionCookie, 'login must set a session cookie')
  assert.match(sessionCookie, /HttpOnly/i)
  assert.match(sessionCookie, /SameSite=Lax/i)
  const body = await ok.json()
  assert.equal(body.user.username, adminUsername)
})

test('the login form works as a native POST before hydration', async () => {
  const native = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: adminUsername, password: adminPassword }),
    redirect: 'manual',
  })
  assert.equal(native.status, 303)
  assert.match(native.headers.get('location') || '', /\/$/)
  const cookie = native.headers.get('set-cookie')
  assert.ok(cookie, 'native login must set a session cookie')
  assert.match(cookie, /HttpOnly/i)

  const me = await fetch(`${base}/api/auth/me`, { headers: { cookie } })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).user.username, adminUsername)

  const bad = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: adminUsername, password: 'definitely wrong' }),
    redirect: 'manual',
  })
  assert.equal(bad.status, 303)
  assert.match(bad.headers.get('location') || '', /\/auth\/login\?error=/)
  // utf8/iron-session may still emit an empty session cookie, but it must not
  // authenticate.
  const badCookie = bad.headers.get('set-cookie')
  if (badCookie) {
    const rejected = await fetch(`${base}/api/auth/me`, { headers: { cookie: badCookie } })
    assert.equal(rejected.status, 401)
  }
})

test('session state is resolved on the server and exposed to the client', async () => {
  const me = await fetch(`${base}/api/auth/me`, { headers: { cookie: sessionCookie } })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).user.username, adminUsername)

  const session = await fetch(`${base}/api/_auth/session`, { headers: { cookie: sessionCookie } })
  assert.equal(session.status, 200)
  assert.equal((await session.json()).user.username, adminUsername)

  // SSR HTML must render the signed-in header, not a logged-out form that
  // swaps after hydration.
  const html = await (await fetch(`${base}/`, { headers: { cookie: sessionCookie } })).text()
  assert.match(html, /Workspace/)
  assert.match(html, new RegExp(adminUsername))
  assert.doesNotMatch(html, />Register</)

  const anonymous = await (await fetch(`${base}/`)).text()
  assert.match(anonymous, /Log in/)
  assert.doesNotMatch(anonymous, />Register</)
})

test('MCP does not accept a browser session without an API token', async () => {
  const response = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: { cookie: sessionCookie, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'session-test', version: '1' } } }),
  })
  assert.equal(response.status, 401)
})

test('logout clears the browser session but leaves token authentication intact', async () => {
  const tokenResponse = await fetch(`${base}/api/tokens`, {
    method: 'POST',
    headers: { cookie: sessionCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'logout-test', scopes: ['read'] }),
  })
  assert.equal(tokenResponse.status, 200)
  const { token } = await tokenResponse.json()

  const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie: sessionCookie } })
  assert.equal(logout.status, 200)
  const cleared = logout.headers.get('set-cookie') || ''
  assert.match(cleared, /nuxt-auth-session=;|Max-Age=0|Expires=/i)

  // Sealed sessions are cleared client-side; a browser that drops the cookie
  // is signed out. (A copied cookie stays valid until expiry or a JWT_SECRET
  // rotation, which is inherent to cookie-sealed sessions.)
  const me = await fetch(`${base}/api/auth/me`)
  assert.equal(me.status, 401)

  const viaToken = await fetch(`${base}/api/artifacts`, { headers: { authorization: `Bearer ${token}` } })
  assert.equal(viaToken.status, 200)
})

test('private REST access requires a session or token', async () => {
  assert.equal((await fetch(`${base}/api/artifacts`)).status, 401)
  const anonymous = await fetch(`${base}/api/artifacts`, { headers: { cookie: 'nuxt-auth-session=forged' } })
  assert.equal(anonymous.status, 401)
})

test('the login page asks for username and exposes no registration link', async () => {
  const html = await (await fetch(`${base}/auth/login`)).text()
  assert.match(html, /Username/)
  assert.match(html, /Password/)
  assert.doesNotMatch(html, /Register|Create your workspace/i)
})

test('an expired or forged token never falls back to the browser session', async () => {
  const fresh = await login(base)
  const response = await fetch(`${base}/api/artifacts`, {
    headers: { cookie: fresh.cookie, authorization: `Bearer ${'x'.repeat(32)}` },
  })
  assert.equal(response.status, 401)
})

test('the bearer scheme is case-insensitive and malformed headers never fall back', async () => {
  const fresh = await login(base)
  const tokenResponse = await fetch(`${base}/api/tokens`, {
    method: 'POST',
    headers: { cookie: fresh.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'case-test', scopes: ['read'] }),
  })
  const { token } = await tokenResponse.json()

  const lower = await fetch(`${base}/api/artifacts`, {
    headers: { authorization: `bearer ${token}` },
  })
  assert.equal(lower.status, 200)

  // Any Authorization header marks an agent request. A malformed value must
  // not silently inherit the owner's cookie.
  for (const value of ['Bearer', 'Bearer ', 'Basic abc', 'token']) {
    const response = await fetch(`${base}/api/artifacts`, {
      headers: { cookie: fresh.cookie, authorization: value },
    })
    assert.equal(response.status, 401, `authorization: ${value}`)
  }
})
