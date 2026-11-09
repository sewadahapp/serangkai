import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 3620 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookie

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-token-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  let healthy = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  if (!healthy) throw new Error('Server did not become healthy before the token test')
  cookie = (await login(base)).cookie
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

const createToken = (body) => fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const bearer = (token) => ({ authorization: `Bearer ${token}` })

test('read tokens can read but cannot write artifacts or mint tokens', async () => {
  const created = await createToken({ name: 'Reader', scopes: ['read'] })
  assert.equal(created.status, 200)
  const { token, id } = await created.json()

  const listed = await fetch(`${base}/api/artifacts`, { headers: bearer(token) })
  assert.equal(listed.status, 200)

  const wrote = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { ...bearer(token), 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Nope', type: 'markdown', content: '# Nope' }) })
  assert.equal(wrote.status, 403)

  const minted = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { ...bearer(token), 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Escalation', scopes: ['full'] }) })
  assert.equal(minted.status, 403)

  const revoked = await fetch(`${base}/api/tokens/${id}`, { method: 'DELETE', headers: { cookie } })
  assert.equal(revoked.status, 200)
  assert.equal((await fetch(`${base}/api/artifacts`, { headers: bearer(token) })).status, 401)
})

test('rejects unknown scopes and honors token expiry', async () => {
  const invalid = await createToken({ name: 'Bad scope', scopes: ['admin'] })
  assert.equal(invalid.status, 400)

  const expired = await createToken({ name: 'Expired', scopes: ['read'], expiresAt: new Date(Date.now() - 60_000).toISOString() })
  assert.equal(expired.status, 200)
  const { token } = await expired.json()
  assert.equal((await fetch(`${base}/api/artifacts`, { headers: bearer(token) })).status, 401)
})

test('write tokens can create artifacts but still cannot manage tokens', async () => {
  const created = await createToken({ name: 'Writer', scopes: ['read', 'write'] })
  const { token } = await created.json()
  const wrote = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { ...bearer(token), 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Written by token', type: 'markdown', content: '# Token' }) })
  assert.equal(wrote.status, 200)
  const minted = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { ...bearer(token), 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Escalation', scopes: ['full'] }) })
  assert.equal(minted.status, 403)
})

test('token management requires a browser session, not a bearer token', async () => {
  const created = await createToken({ name: 'Enumerate', scopes: ['read', 'write'] })
  const { token } = await created.json()

  // Listing credentials is not workspace content, so no token scope grants it.
  const listed = await fetch(`${base}/api/tokens`, { headers: bearer(token) })
  assert.equal(listed.status, 401)

  // The session still works.
  const viaSession = await fetch(`${base}/api/tokens`, { headers: { cookie } })
  assert.equal(viaSession.status, 200)
  assert.ok((await viaSession.json()).tokens.length > 0)
})
