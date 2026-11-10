import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import {
  approveDeviceAuthorization,
  consumeAuthorizationCode,
  createAuthorizationCode,
  createDeviceAuthorization,
  denyDeviceAuthorization,
  deviceConsentFingerprint,
  findDeviceByUserCode,
  findGrantByRefreshToken,
  issueTokens,
  pollDeviceAuthorization,
  redirectUriMatches,
  isAcceptableRedirectUri,
  normalizeScopes,
  parseResourceIndicator,
  parseScopes,
  resourceMatches,
  rotateRefreshToken,
  verifyPkce,
  base64UrlEncode,
  timingSafeEqual,
  pruneAbandonedClients,
} from '../server/utils/oauth.ts'
import { BOOTSTRAP_SQL } from '../server/db/bootstrap.ts'
import * as schema from '../server/db/schema.ts'

/**
 * OAuth logic that is hard to observe through the HTTP surface: the
 * single-use code guarantee across driver result shapes, redirect matching, and
 * PKCE. The full handshake lives in tests/oauth-flow.test.mjs.
 */

const codes = sqliteTable('oauth_codes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  userId: text('user_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  scopes: text('scopes', { mode: 'json' }).notNull(),
  codeChallenge: text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull(),
  resource: text('resource'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  consumedAt: integer('consumed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

function makeDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`CREATE TABLE oauth_codes (
    id TEXT PRIMARY KEY NOT NULL,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '[]',
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL DEFAULT 'S256',
    resource TEXT,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER,
    created_at INTEGER NOT NULL
  )`)
  return drizzle(sqlite)
}

const input = {
  clientId: 'client-1',
  userId: 'user-1',
  redirectUri: 'https://app.example/callback',
  scopes: ['read'],
  codeChallenge: 'challenge',
  codeChallengeMethod: 'S256',
}

test('a code can be consumed only once', async () => {
  const db = makeDb()
  const code = await createAuthorizationCode(db, input)

  const first = await consumeAuthorizationCode(db, code)
  assert.equal(first.ok, true)

  const second = await consumeAuthorizationCode(db, code)
  assert.equal(second.ok, false)
  assert.equal(second.error, 'invalid_grant')
})

test('an unknown code is rejected', async () => {
  const db = makeDb()
  assert.equal((await consumeAuthorizationCode(db, 'never-issued')).ok, false)
})

test('an expired code is rejected before the update', async () => {
  const db = makeDb()
  const code = await createAuthorizationCode(db, input)
  // Age it past the five-minute TTL.
  await db.update(codes).set({ expiresAt: new Date(Date.now() - 1000) })
  const result = await consumeAuthorizationCode(db, code)
  assert.equal(result.ok, false)
})

test('the affected-row count is read from bun-sqlite, better-sqlite3, and D1 shapes', async () => {
  // The winner of a concurrent exchange must be recognized in every runtime.
  // A shape this does not understand must fail closed, never open.
  const shapes = [
    { changes: 1 },          // bun:sqlite / better-sqlite3
    { rowsAffected: 1 },     // some drivers
    { meta: { changes: 1 } }, // Cloudflare D1
  ]
  for (const shape of shapes) {
    const db = makeDb()
    const code = await createAuthorizationCode(db, input)
    const real = db.update(codes)
    // Swap the update builder for one that reports this driver's shape.
    const original = db.update
    db.update = () => ({ set: () => ({ where: async () => shape }) })
    const result = await consumeAuthorizationCode(db, code)
    db.update = original
    assert.equal(result.ok, true, `should accept ${JSON.stringify(shape)}`)
  }

  for (const shape of [{}, { changes: 0 }, { meta: { changes: 0 } }]) {
    const db = makeDb()
    const code = await createAuthorizationCode(db, input)
    const original = db.update
    db.update = () => ({ set: () => ({ where: async () => shape }) })
    const result = await consumeAuthorizationCode(db, code)
    db.update = original
    assert.equal(result.ok, false, `should reject ${JSON.stringify(shape)}`)
  }
})

test('redirect matching is exact except for loopback ports', () => {
  assert.equal(redirectUriMatches('https://a.example/cb', 'https://a.example/cb'), true)
  assert.equal(redirectUriMatches('https://a.example/cb?x=1', 'https://a.example/cb'), false)
  assert.equal(redirectUriMatches('https://a.example/other', 'https://a.example/cb'), false)
  assert.equal(redirectUriMatches('https://evil.example/cb', 'https://a.example/cb'), false)
  assert.equal(redirectUriMatches('http://a.example/cb', 'https://a.example/cb'), false)

  // RFC 8252 §7.3: a loopback client picks its port at runtime.
  assert.equal(redirectUriMatches('http://127.0.0.1:51234/cb', 'http://127.0.0.1:33418/cb'), true)
  assert.equal(redirectUriMatches('http://localhost:9999/cb', 'http://localhost:1111/cb'), true)
  // Still no path or host widening.
  assert.equal(redirectUriMatches('http://127.0.0.1:51234/other', 'http://127.0.0.1:33418/cb'), false)
  assert.equal(redirectUriMatches('http://127.0.0.1:51234/cb?x=1', 'http://127.0.0.1:33418/cb'), false)
  // A loopback registration must not admit a remote host.
  assert.equal(redirectUriMatches('https://evil.example/cb', 'http://127.0.0.1:33418/cb'), false)
})

test('only HTTPS, loopback HTTP, or native custom schemes are acceptable redirects', () => {
  assert.equal(isAcceptableRedirectUri('https://app.example/cb'), true)
  assert.equal(isAcceptableRedirectUri('http://127.0.0.1:8080/cb'), true)
  assert.equal(isAcceptableRedirectUri('http://localhost:8080/cb'), true)
  assert.equal(isAcceptableRedirectUri('myapp://callback'), true)

  assert.equal(isAcceptableRedirectUri('http://app.example/cb'), false, 'remote plain HTTP')
  assert.equal(isAcceptableRedirectUri('https://app.example/cb#token'), false, 'fragment')
  assert.equal(isAcceptableRedirectUri('javascript:alert(1)'), false)
  assert.equal(isAcceptableRedirectUri('not a url'), false)
  assert.equal(isAcceptableRedirectUri(''), false)
})

test('scope parsing never widens what was asked for', () => {
  assert.deepEqual(parseScopes('read'), ['read'])
  assert.deepEqual(parseScopes('read write'), ['read', 'write'])
  assert.deepEqual(parseScopes(['write']), ['write'])
  // `full` can mint API tokens, so it is never grantable over OAuth.
  assert.deepEqual(parseScopes('read write full'), ['read', 'write'])
  assert.deepEqual(parseScopes('full'), [])
  assert.deepEqual(parseScopes(''), [])
  assert.deepEqual(parseScopes(undefined), [])

  // A client request with no scope defaults to the useful pair…
  assert.deepEqual(normalizeScopes(''), ['read', 'write'])
  assert.deepEqual(normalizeScopes(undefined), ['read', 'write'])
  // …but an explicit selection is respected as-is.
  assert.deepEqual(normalizeScopes('read'), ['read'])
  // A non-empty request that only names unsupported scopes is not widened
  // into the default pair.
  assert.deepEqual(normalizeScopes('full'), [])
})

test('PKCE verification accepts only the matching verifier', async () => {
  const verifier = 'a'.repeat(64)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64UrlEncode(new Uint8Array(digest))

  assert.equal(await verifyPkce(challenge, verifier), true)
  assert.equal(await verifyPkce(challenge, 'b'.repeat(64)), false)
  assert.equal(await verifyPkce('', verifier), false)
  // RFC 7636 bounds: 43-128 unreserved characters.
  assert.equal(await verifyPkce(challenge, 'short'), false)
  assert.equal(await verifyPkce(challenge, '!'.repeat(64)), false)
})

test('timing-safe comparison is correct', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true)
  assert.equal(timingSafeEqual('abc', 'abd'), false)
  assert.equal(timingSafeEqual('abc', 'abcd'), false)
  assert.equal(timingSafeEqual('', ''), true)
})

test('pruning removes abandoned registrations but never an approved client', async () => {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE oauth_clients (id TEXT PRIMARY KEY, client_name TEXT, client_uri TEXT,
      redirect_uris TEXT NOT NULL DEFAULT '[]', scopes TEXT NOT NULL DEFAULT '[]',
      token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none', client_secret_hash TEXT,
      created_at INTEGER NOT NULL);
    CREATE TABLE oauth_tokens (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, user_id TEXT NOT NULL,
      api_token_id TEXT NOT NULL, scopes TEXT NOT NULL DEFAULT '[]', access_expires_at INTEGER NOT NULL,
      refresh_token_hash TEXT NOT NULL, refresh_expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
  `)
  const db = drizzle(sqlite)
  const oldSeconds = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)
  const nowSeconds = Math.floor(Date.now() / 1000)

  // Seed with raw SQL: the tables above are minimal stand-ins for the real
  // schema, so Drizzle's column mapping does not apply to them.
  sqlite.exec(`
    INSERT INTO oauth_clients (id, created_at) VALUES
      ('abandoned-old', ${oldSeconds}),
      ('abandoned-fresh', ${nowSeconds}),
      ('approved-old', ${oldSeconds});
    INSERT INTO oauth_tokens (id, client_id, user_id, api_token_id, access_expires_at, refresh_token_hash, refresh_expires_at, created_at)
      VALUES ('grant-1', 'approved-old', 'user-1', 'token-1', ${nowSeconds}, 'hash', ${nowSeconds}, ${nowSeconds});
  `)

  const removed = await pruneAbandonedClients(db)
  assert.equal(removed, 1)

  const remaining = sqlite.prepare('SELECT id FROM oauth_clients ORDER BY id').all().map(r => r.id)
  assert.deepEqual(remaining, ['abandoned-fresh', 'approved-old'])
})

test('resource indicators match structurally but never across origins or paths', () => {
  const expected = 'https://serangkai.example/api/mcp'
  assert.equal(resourceMatches(expected, expected), true)
  assert.equal(resourceMatches('https://SERANGKAI.example:443/api/mcp', expected), true)
  assert.equal(resourceMatches('https://serangkai.example/api/other', expected), false)
  assert.equal(resourceMatches('http://serangkai.example/api/mcp', expected), false)
  assert.equal(resourceMatches('https://evil.example/api/mcp', expected), false)
  assert.equal(resourceMatches('https://serangkai.example/api/mcp?x=1', expected), false)
  assert.equal(resourceMatches('https://serangkai.example/api/mcp#fragment', expected), false)
  assert.equal(resourceMatches('https://user:pass@serangkai.example/api/mcp', expected), false)

  assert.deepEqual(parseResourceIndicator(undefined, expected), { ok: true, resource: expected })
  assert.deepEqual(parseResourceIndicator('', expected), { ok: true, resource: expected })
  assert.deepEqual(parseResourceIndicator('https://SERANGKAI.example:443/api/mcp', expected), { ok: true, resource: expected })
  assert.deepEqual(parseResourceIndicator('https://evil.example/api/mcp', expected), { ok: false })
})

function makeOAuthDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON;')
  sqlite.exec(BOOTSTRAP_SQL)
  const db = drizzle(sqlite, { schema })
  return { sqlite, db }
}

async function seedGrant(db, { resource = 'https://serangkai.example/api/mcp', scopes = ['read', 'write'] } = {}) {
  const now = new Date()
  await db.insert(schema.users).values({
    id: 'user-1',
    email: 'owner@example.test',
    username: 'owner',
    passwordHash: 'not-used',
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(schema.oauthClients).values({
    id: 'client-1',
    clientName: 'Test client',
    redirectUris: ['https://client.example/cb'],
    scopes,
    tokenEndpointAuthMethod: 'none',
    createdAt: now,
  })
  return issueTokens(db, {
    clientId: 'client-1',
    userId: 'user-1',
    scopes,
    label: 'Test client',
    resource,
  })
}

test('concurrent refresh rotation has exactly one winner', async () => {
  const { sqlite, db } = makeOAuthDb()
  const issued = await seedGrant(db)

  const [first, second] = await Promise.all([
    rotateRefreshToken(db, issued.refreshToken, 'client-1', 'https://serangkai.example/api/mcp'),
    rotateRefreshToken(db, issued.refreshToken, 'client-1', 'https://serangkai.example/api/mcp'),
  ])

  const winners = [first, second].filter(result => result.ok)
  const losers = [first, second].filter(result => !result.ok)
  assert.equal(winners.length, 1, 'one rotation must win')
  assert.equal(losers.length, 1)
  assert.equal(losers[0].error, 'invalid_grant')

  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM oauth_tokens').get().n, 1)
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM api_tokens').get().n, 1)

  // Only the winner's refresh token resolves to the surviving grant.
  const survivor = await findGrantByRefreshToken(db, winners[0].tokens.refreshToken)
  assert.ok(survivor)
  assert.equal(await findGrantByRefreshToken(db, issued.refreshToken), undefined)
})

test('refresh rotation rejects a different audience and adopts a legacy null binding', async () => {
  const { sqlite, db } = makeOAuthDb()
  const issued = await seedGrant(db)

  const mismatch = await rotateRefreshToken(
    db,
    issued.refreshToken,
    'client-1',
    'https://other.example/api/mcp',
  )
  assert.equal(mismatch.ok, false)
  assert.equal(mismatch.error, 'invalid_target')
  // The failed attempt must not consume the refresh token.
  assert.ok(await findGrantByRefreshToken(db, issued.refreshToken))

  // A grant created before audience binding existed is adopted on refresh.
  sqlite.prepare('UPDATE oauth_tokens SET resource = NULL').run()
  const rotated = await rotateRefreshToken(
    db,
    issued.refreshToken,
    'client-1',
    'https://serangkai.example/api/mcp',
  )
  assert.equal(rotated.ok, true)
  assert.equal(
    sqlite.prepare('SELECT resource FROM oauth_tokens').get().resource,
    'https://serangkai.example/api/mcp',
  )
})

test('issued OAuth tokens carry the audience and never gain full scope', async () => {
  const { sqlite, db } = makeOAuthDb()
  await seedGrant(db, { scopes: ['read', 'write', 'full'] })
  const grant = sqlite.prepare('SELECT resource, scopes FROM oauth_tokens').get()
  assert.equal(grant.resource, 'https://serangkai.example/api/mcp')
  assert.equal(grant.scopes, JSON.stringify(['read', 'write']))
})

/** Seed an owner, a client, and a device authorization (approved by default). */
async function seedDevice(db, { scopes = ['read', 'write'], approve = true } = {}) {
  const now = new Date()
  await db.insert(schema.users).values({
    id: 'user-1',
    email: 'owner@example.test',
    username: 'owner',
    passwordHash: 'not-used',
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(schema.oauthClients).values({
    id: 'client-1',
    clientName: 'Device client',
    redirectUris: ['https://client.example/cb'],
    scopes,
    tokenEndpointAuthMethod: 'none',
    createdAt: now,
  })
  const created = await createDeviceAuthorization(db, {
    clientId: 'client-1',
    scopes,
    resource: 'https://serangkai.example/api/mcp',
  })
  assert.equal(created.ok, true)
  if (approve) {
    const row = await findDeviceByUserCode(db, created.userCode)
    const approved = await approveDeviceAuthorization(db, row.id, 'user-1', scopes)
    assert.equal(approved.ok, true)
  }
  return created
}

const RESOURCE = 'https://serangkai.example/api/mcp'

test('concurrent device-code redemption has exactly one winner', async () => {
  const { sqlite, db } = makeOAuthDb()
  const device = await seedDevice(db)

  const [first, second] = await Promise.all([
    pollDeviceAuthorization(db, device.deviceCode, 'client-1', RESOURCE),
    pollDeviceAuthorization(db, device.deviceCode, 'client-1', RESOURCE),
  ])
  const winners = [first, second].filter(result => result.ok)
  const losers = [first, second].filter(result => !result.ok)
  assert.equal(winners.length, 1, 'one redemption must win')
  assert.equal(losers[0].error, 'invalid_grant')

  // The loser's inserts were cleaned up: exactly one usable token pair exists.
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM api_tokens').get().n, 1)
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM oauth_tokens').get().n, 1)
  const row = sqlite.prepare('SELECT consumed_at, api_token_id FROM oauth_device_codes').get()
  assert.ok(row.consumed_at)
  const grant = sqlite.prepare('SELECT api_token_id FROM oauth_tokens').get()
  assert.equal(row.api_token_id, grant.api_token_id)

  // The code is single-use after the win.
  const replay = await pollDeviceAuthorization(db, device.deviceCode, 'client-1', RESOURCE)
  assert.equal(replay.ok, false)
  assert.equal(replay.error, 'invalid_grant')
})

test('a token-issuance failure rolls back the device-code claim', async () => {
  const { sqlite, db } = makeOAuthDb()
  const device = await seedDevice(db)

  // Inject a storage failure between minting the token and writing the grant.
  sqlite.exec(`CREATE TRIGGER fail_grant BEFORE INSERT ON oauth_tokens BEGIN SELECT RAISE(ABORT, 'injected failure'); END`)
  await assert.rejects(() => pollDeviceAuthorization(db, device.deviceCode, 'client-1', RESOURCE))

  // Nothing was consumed and nothing usable was left behind.
  const row = sqlite.prepare('SELECT consumed_at, api_token_id FROM oauth_device_codes').get()
  assert.equal(row.consumed_at, null)
  assert.equal(row.api_token_id, null)
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM api_tokens').get().n, 0)
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM oauth_tokens').get().n, 0)

  // The same code redeemable once the storage fault clears.
  sqlite.exec('DROP TRIGGER fail_grant')
  const retry = await pollDeviceAuthorization(db, device.deviceCode, 'client-1', RESOURCE)
  assert.equal(retry.ok, true)
  assert.ok(retry.tokens.accessToken)
})

test('the D1 batch path checks the claim result and fails closed on unknown shapes', async () => {
  const deviceRow = {
    id: 'device-hash',
    clientId: 'client-1',
    userId: 'user-1',
    scopes: ['read'],
    resource: null,
    approvedAt: new Date(),
    deniedAt: null,
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  }
  function mockD1(claimResult) {
    const statements = []
    return {
      statements,
      select: () => ({ from: table => ({ where: () => ({ get: async () =>
        table === schema.oauthDeviceCodes ? deviceRow : { id: 'client-1', clientName: 'Mock' } }) }) }),
      insert: table => ({ values: (values) => { const s = { op: 'insert', table, values }; statements.push(s); return s } }),
      update: table => ({ set: set => ({ where: (where) => { const s = { op: 'update', table, set, where }; statements.push(s); return s } }) }),
      delete: table => ({ where: (where) => { const s = { op: 'delete', table, where }; statements.push(s); return s } }),
      batch: async statements => statements.map(s => s.op === 'update' ? claimResult : {}),
    }
  }

  const winner = mockD1({ meta: { changes: 1 } })
  const won = await pollDeviceAuthorization(winner, 'device-code', 'client-1', RESOURCE)
  assert.equal(won.ok, true)
  assert.ok(won.tokens.accessToken)
  // Insert, insert, claim, then the two orphan cleanups — one atomic batch.
  assert.deepEqual(winner.statements.map(s => s.op), ['insert', 'insert', 'update', 'delete', 'delete'])
  assert.equal(winner.statements[2].table, schema.oauthDeviceCodes)
  assert.ok(winner.statements[2].set.apiTokenId, 'the claim links the minted API token')
  assert.equal(winner.statements[3].table, schema.oauthTokens)
  assert.equal(winner.statements[4].table, schema.apiTokens)

  for (const shape of [{ meta: { changes: 0 } }, {}]) {
    const db = mockD1(shape)
    const result = await pollDeviceAuthorization(db, 'device-code', 'client-1', RESOURCE)
    assert.equal(result.ok, false, `must fail closed for ${JSON.stringify(shape)}`)
    assert.equal(result.error, 'invalid_grant')
  }
})

test('concurrent device decisions have exactly one winner', async () => {
  // approve/approve, approve/deny, deny/deny: the conditional update decides.
  for (const kind of ['approve/approve', 'approve/deny', 'deny/deny']) {
    const { sqlite, db } = makeOAuthDb()
    const device = await seedDevice(db, { approve: false })
    const row = await findDeviceByUserCode(db, device.userCode)
    const approve = () => approveDeviceAuthorization(db, row.id, 'user-1', ['read'])
    const deny = () => denyDeviceAuthorization(db, row.id)
    const [a, b] = kind === 'approve/approve' ? await Promise.all([approve(), approve()])
      : kind === 'approve/deny' ? await Promise.all([approve(), deny()])
        : await Promise.all([deny(), deny()])
    assert.equal([a, b].filter(r => r.ok).length, 1, `${kind}: one decision must win`)
    assert.equal([a, b].filter(r => !r.ok)[0].error, 'already_decided', kind)
    const after = sqlite.prepare('SELECT approved_at, denied_at FROM oauth_device_codes').get()
    assert.ok(!(after.approved_at && after.denied_at), `${kind}: never both decided`)
    assert.ok(after.approved_at || after.denied_at, `${kind}: exactly one decision stored`)
  }
})

test('expired or consumed device requests cannot change state', async () => {
  const { sqlite, db } = makeOAuthDb()
  const device = await seedDevice(db, { approve: false })
  const row = await findDeviceByUserCode(db, device.userCode)
  sqlite.prepare('UPDATE oauth_device_codes SET expires_at = ?').run(Math.floor((Date.now() - 1000) / 1000))
  assert.equal((await approveDeviceAuthorization(db, row.id, 'user-1', ['read'])).error, 'expired')
  assert.equal((await denyDeviceAuthorization(db, row.id)).error, 'expired')

  // A consumed code is past every decision, even after restoring expiry.
  sqlite.prepare('UPDATE oauth_device_codes SET expires_at = ?').run(Math.floor((Date.now() + 600_000) / 1000))
  assert.equal((await approveDeviceAuthorization(db, row.id, 'user-1', ['read'])).ok, true)
  assert.equal((await pollDeviceAuthorization(db, device.deviceCode, 'client-1', RESOURCE)).ok, true)
  assert.equal((await approveDeviceAuthorization(db, row.id, 'user-1', ['read'])).error, 'already_decided')
  assert.equal((await denyDeviceAuthorization(db, row.id)).error, 'already_decided')
})

test('device polling reports pending, denied, expired, and binding errors', async () => {
  const { sqlite, db } = makeOAuthDb()
  const device = await seedDevice(db, { approve: false })
  assert.equal((await pollDeviceAuthorization(db, device.deviceCode, 'client-1')).error, 'authorization_pending')
  assert.equal((await pollDeviceAuthorization(db, device.deviceCode, 'other-client')).error, 'invalid_grant')
  assert.equal((await pollDeviceAuthorization(db, device.deviceCode, 'client-1', 'https://evil.example/api/mcp')).error, 'invalid_target')

  const row = await findDeviceByUserCode(db, device.userCode)
  await denyDeviceAuthorization(db, row.id)
  assert.equal((await pollDeviceAuthorization(db, device.deviceCode, 'client-1')).error, 'access_denied')

  const second = await createDeviceAuthorization(db, { clientId: 'client-1', scopes: ['read'] })
  sqlite.prepare('UPDATE oauth_device_codes SET expires_at = ? WHERE user_code = ?')
    .run(Math.floor((Date.now() - 1000) / 1000), second.userCode.replace('-', ''))
  assert.equal((await pollDeviceAuthorization(db, second.deviceCode, 'client-1')).error, 'expired_token')
})

test('device authorization creation is bounded per client', async () => {
  const { db } = makeOAuthDb()
  await seedDevice(db, { approve: false })
  for (let i = 1; i < 100; i++) {
    const result = await createDeviceAuthorization(db, { clientId: 'client-1', scopes: ['read'] })
    assert.equal(result.ok, true, `create ${i + 1} should pass`)
  }
  const overflow = await createDeviceAuthorization(db, { clientId: 'client-1', scopes: ['read'] })
  assert.equal(overflow.ok, false)
  assert.equal(overflow.error, 'slow_down')
})

test('the device consent fingerprint binds every displayed value', async () => {
  const input = {
    deviceId: 'device-1',
    clientId: 'client-1',
    userCode: 'ABCDABCD',
    scopes: ['read', 'write'],
    resource: RESOURCE,
    userId: 'user-1',
  }
  const hash = await deviceConsentFingerprint(input)
  assert.equal(await deviceConsentFingerprint(input), hash)
  for (const patch of [
    { deviceId: 'device-2' },
    { clientId: 'client-2' },
    { userCode: 'BCDEBCDE' },
    { scopes: ['read'] },
    { resource: 'https://evil.example/api/mcp' },
    { userId: 'user-2' },
  ]) {
    assert.notEqual(await deviceConsentFingerprint({ ...input, ...patch }), hash, JSON.stringify(patch))
  }
})
