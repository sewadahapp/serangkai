import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import {
  consumeAuthorizationCode,
  createAuthorizationCode,
  redirectUriMatches,
  isAcceptableRedirectUri,
  normalizeScopes,
  parseScopes,
  verifyPkce,
  base64UrlEncode,
  timingSafeEqual,
  pruneAbandonedClients,
} from '../server/utils/oauth.ts'

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
  // …but an explicit selection is respected as-is.
  assert.deepEqual(normalizeScopes('read'), ['read'])
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
