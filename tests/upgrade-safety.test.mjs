import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { sql } from 'drizzle-orm'
import { ensureUserSchema, ensureGlobalSlugUniqueness, ensureOAuthSchema } from '../server/db/migrations.ts'
import { signShareKey, isValidShareKey } from '../server/utils/share.ts'

/**
 * Upgrade safety: a database created by an OLDER Serangkai (pre single-owner
 * username, pre RFC 8707 resource, pre atomic device redemption) must survive
 * the current startup migrations with all rows intact. This mirrors what a
 * deployed SQLite/D1 instance experiences on upgrade; it never touches live.
 */

function oldSchema() {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON;')
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE api_tokens (
      id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL DEFAULT '[]',
      last_used_at INTEGER, expires_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE folders (
      id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, parent_id TEXT,
      name TEXT NOT NULL, path TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE artifacts (
      id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, folder_id TEXT,
      slug TEXT NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private', content_path TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(user_id, slug)
    );
    CREATE TABLE artifact_versions (
      id TEXT PRIMARY KEY NOT NULL, artifact_id TEXT NOT NULL, version INTEGER NOT NULL,
      content_path TEXT NOT NULL, metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(artifact_id, version)
    );
    CREATE TABLE oauth_clients (
      id TEXT PRIMARY KEY NOT NULL, client_name TEXT, client_uri TEXT,
      redirect_uris TEXT NOT NULL DEFAULT '[]', scopes TEXT NOT NULL DEFAULT '[]',
      token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none', client_secret_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE oauth_tokens (
      id TEXT PRIMARY KEY NOT NULL, client_id TEXT NOT NULL, user_id TEXT NOT NULL,
      api_token_id TEXT NOT NULL, scopes TEXT NOT NULL DEFAULT '[]',
      access_expires_at INTEGER NOT NULL, refresh_token_hash TEXT NOT NULL UNIQUE,
      refresh_expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE oauth_device_codes (
      id TEXT PRIMARY KEY NOT NULL, client_id TEXT NOT NULL, user_id TEXT,
      user_code TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL DEFAULT '[]', resource TEXT,
      approved_at INTEGER, denied_at INTEGER, consumed_at INTEGER,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `)
  return sqlite
}

test('upgrading an old database preserves identity, artifacts, grants, and tokens', async () => {
  const sqlite = oldSchema()
  const db = drizzle(sqlite)
  const now = Math.floor(Date.now() / 1000)

  sqlite.prepare(`INSERT INTO users (id,email,password_hash,created_at,updated_at) VALUES ('owner-1','owner@example.test','scrypt-hash',?,?)`).run(now, now)
  sqlite.prepare(`INSERT INTO api_tokens (id,user_id,name,token_hash,scopes,created_at) VALUES ('tok-1','owner-1','Agent','hash-1','["read","write"]',?)`).run(now)
  sqlite.prepare(`INSERT INTO artifacts (id,user_id,slug,title,type,visibility,content_path,created_at,updated_at) VALUES ('art-1','owner-1','my-doc','My Doc','markdown','unlisted','owner-1/art-1/content',?,?)`).run(now, now)
  sqlite.prepare(`INSERT INTO artifact_versions (id,artifact_id,version,content_path,created_at) VALUES ('ver-1','art-1',1,'owner-1/art-1/content',?)`).run(now)
  sqlite.prepare(`INSERT INTO oauth_clients (id,client_name,redirect_uris,scopes,created_at) VALUES ('cli-1','MCP client','["https://app.example/cb"]','["read"]',?)`).run(now)
  sqlite.prepare(`INSERT INTO oauth_tokens (id,client_id,user_id,api_token_id,scopes,access_expires_at,refresh_token_hash,refresh_expires_at,created_at) VALUES ('grant-1','cli-1','owner-1','tok-1','["read"]',?, 'refresh-hash-1', ?, ?)`).run(now + 3600, now + 86400, now)
  sqlite.prepare(`INSERT INTO oauth_device_codes (id,client_id,user_code,scopes,expires_at,created_at) VALUES ('dev-1','cli-1','ABCDABCD','["read"]',?,?)`).run(now + 600, now)

  // The current startup migration path.
  await ensureUserSchema(db)
  await ensureGlobalSlugUniqueness(db)
  await ensureOAuthSchema(db)

  // Identity preserved; username column added without touching the row.
  const user = sqlite.prepare(`SELECT id,email,password_hash,username FROM users WHERE id='owner-1'`).get()
  assert.equal(user.email, 'owner@example.test')
  assert.equal(user.password_hash, 'scrypt-hash')

  // Artifacts + versions intact.
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM artifacts WHERE id='art-1'`).get().n, 1)
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM artifact_versions WHERE artifact_id='art-1'`).get().n, 1)
  assert.equal(sqlite.prepare(`SELECT visibility FROM artifacts WHERE id='art-1'`).get().visibility, 'unlisted')

  // API token + OAuth grant intact; resource column added (null until bound).
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM api_tokens WHERE id='tok-1'`).get().n, 1)
  const grant = sqlite.prepare(`SELECT api_token_id, resource FROM oauth_tokens WHERE id='grant-1'`).get()
  assert.equal(grant.api_token_id, 'tok-1')
  assert.equal(grant.resource, null)

  // Device code intact; api_token_id column added (null).
  const device = sqlite.prepare(`SELECT user_code, api_token_id FROM oauth_device_codes WHERE id='dev-1'`).get()
  assert.equal(device.user_code, 'ABCDABCD')
  assert.equal(device.api_token_id, null)

  // Running the migrations again is idempotent (no duplicate-column throw).
  await ensureUserSchema(db)
  await ensureOAuthSchema(db)
  assert.equal(sqlite.prepare(`SELECT COUNT(*) n FROM users`).get().n, 1)
})

test('signed share links remain valid across an upgrade with a stable secret', () => {
  // The key is an HMAC of the artifact id under SHARE_SECRET; with the secret
  // unchanged across an upgrade, existing links keep validating.
  const key = signShareKey('art-1')
  assert.match(key, /^[a-f0-9]{64}$/)
  assert.ok(isValidShareKey('art-1', key))
  assert.ok(!isValidShareKey('art-1', '0'.repeat(64)))
  assert.ok(!isValidShareKey('art-2', key))
})
