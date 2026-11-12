import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, adminPassword, adminUsername } from './helpers/auth.mjs'

/**
 * Owner login is the only password surface, so online guessing must be
 * expensive for both the hydrated JSON form and the native HTML form. The
 * tests also prove X-Forwarded-For cannot reset the bucket unless a proxy is
 * explicitly trusted.
 */

const servers = []

async function startServer(extraEnv = {}) {
  const port = 4700 + Math.floor(Math.random() * 200)
  const dataDir = await mkdtemp(join(tmpdir(), 'serangkai-login-test-'))
  const child = spawn(serverRuntime, ['.output/server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      ...adminEnv(),
      PORT: String(port),
      JWT_SECRET: randomBytes(32).toString('hex'),
      SHARE_SECRET: randomBytes(32).toString('hex'),
      DATABASE_PATH: join(dataDir, 'serangkai.db'),
      STORAGE_PATH: join(dataDir, 'files'),
      ...extraEnv,
    },
    stdio: 'ignore',
  })
  const base = `http://127.0.0.1:${port}`
  let healthy = false
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!healthy) {
    child.kill('SIGTERM')
    throw new Error('Login test server did not become healthy')
  }
  const server = { base, child, dataDir }
  servers.push(server)
  return server
}

before(async () => {})

after(async () => {
  for (const server of servers) {
    server.child?.kill('SIGTERM')
    await rm(server.dataDir, { recursive: true, force: true })
  }
})

function jsonLogin(base, { username = adminUsername, password = 'wrong', forwarded } = {}) {
  return fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(forwarded ? { 'x-forwarded-for': forwarded } : {}),
    },
    body: JSON.stringify({ username, password }),
  })
}

function formLogin(base, { username = adminUsername, password = 'wrong', forwarded } = {}) {
  return fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(forwarded ? { 'x-forwarded-for': forwarded } : {}),
    },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  })
}

test('JSON and native form login are throttled per trusted client address', async () => {
  const { base } = await startServer({
    TRUST_PROXY: 'true',
    SERANGKAI_LOGIN_RATE_LIMIT: '3',
    SERANGKAI_LOGIN_RATE_WINDOW_MS: '60000',
  })

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await jsonLogin(base, { forwarded: '203.0.113.10' })
    assert.equal(response.status, 401, `attempt ${attempt}`)
    const body = await response.json()
    // Unknown users and wrong passwords are indistinguishable.
    assert.equal(body.message, 'Invalid credentials')
  }
  const limited = await jsonLogin(base, { forwarded: '203.0.113.10' })
  assert.equal(limited.status, 429)
  assert.match(limited.headers.get('retry-after') || '', /^\d+$/)

  // A different address has its own bucket.
  assert.equal((await jsonLogin(base, { forwarded: '203.0.113.11' })).status, 401)

  // The native form path is protected too, and still answers with the generic
  // redirect rather than revealing whether the account exists.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await formLogin(base, { forwarded: '203.0.113.12' })
    assert.equal(response.status, 303)
    assert.match(response.headers.get('location') || '', /error=invalid/)
  }
  const formLimited = await formLogin(base, { forwarded: '203.0.113.12' })
  assert.equal(formLimited.status, 303)
  assert.match(formLimited.headers.get('retry-after') || '', /^\d+$/)

  // A correct login from an untouched bucket still works and clears it.
  const ok = await jsonLogin(base, {
    forwarded: '203.0.113.13',
    username: adminUsername,
    password: adminPassword,
  })
  assert.equal(ok.status, 200)
  assert.ok(ok.headers.get('set-cookie'))
})

test('X-Forwarded-For is ignored unless the proxy is trusted', async () => {
  const { base } = await startServer({
    SERANGKAI_LOGIN_RATE_LIMIT: '2',
    SERANGKAI_LOGIN_RATE_WINDOW_MS: '60000',
  })

  // Every request comes from the same loopback socket. Rotating the header must
  // not create new buckets.
  assert.equal((await jsonLogin(base, { forwarded: '198.51.100.1' })).status, 401)
  assert.equal((await jsonLogin(base, { forwarded: '198.51.100.2' })).status, 401)
  const blocked = await jsonLogin(base, { forwarded: '198.51.100.3' })
  assert.equal(blocked.status, 429)
})

test('a known device keeps its own bucket when the shared address is exhausted', async () => {
  // No trusted proxy: every request shares the loopback bucket, as it would
  // behind an untrusted reverse proxy.
  const { base } = await startServer({
    SERANGKAI_LOGIN_RATE_LIMIT: '2',
    SERANGKAI_LOGIN_RATE_WINDOW_MS: '60000',
  })
  const login = (password, cookie) => fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ username: adminUsername, password }),
  })

  // The owner signs in once and receives the device cookie.
  const first = await login(adminPassword)
  assert.equal(first.status, 200)
  const deviceCookie = first.headers.getSetCookie().find(value => value.startsWith('serangkai_device='))
  assert.ok(deviceCookie, 'device cookie issued')
  assert.match(deviceCookie, /HttpOnly/i)
  assert.match(deviceCookie, /Path=\/api\/auth\/login/i)
  const device = deviceCookie.split(';')[0]

  // A stranger exhausts the shared bucket.
  assert.equal((await login('wrong')).status, 401)
  assert.equal((await login('wrong')).status, 401)
  assert.equal((await login(adminPassword)).status, 429)

  // A forged device cookie does not escape the shared bucket.
  assert.equal((await login(adminPassword, `serangkai_device=${'a'.repeat(32)}.${'b'.repeat(64)}`)).status, 429)

  // The owner's known browser still signs in.
  assert.equal((await login(adminPassword, device)).status, 200)

  // The device bucket is still a real limit for whoever holds the cookie.
  assert.equal((await login('wrong', device)).status, 401)
  assert.equal((await login('wrong', device)).status, 401)
  assert.equal((await login(adminPassword, device)).status, 429)
})
