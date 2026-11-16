import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createClient } from '@libsql/client/web'
import { eq, sql } from 'drizzle-orm'
import { createTursoDatabase } from '../server/db/turso.ts'
import { getTursoConfig } from '../server/db/provider.ts'
import * as schema from '../server/db/schema.ts'
import { startLibsqlMock } from './helpers/libsql-mock.mjs'
import {
  issueTokens, rotateRefreshToken, createAuthorizationCode, consumeAuthorizationCode,
  createDeviceAuthorization, findDeviceByUserCode, approveDeviceAuthorization, pollDeviceAuthorization,
} from '../server/utils/oauth.ts'

const RESOURCE = 'https://serangkai.example/api/mcp'

async function database(t, prepare) {
  const mock = startLibsqlMock()
  t.after(() => mock.close())
  if (prepare) await prepare(mock.sqlite)
  const client = createClient({ url: mock.url, authToken: mock.token })
  t.after(() => client.close())
  const db = await createTursoDatabase(client)
  return { mock, client, db }
}

async function seed(db) {
  await db.insert(schema.users).values({ id: 'owner', email: 'owner@test.local', username: 'owner', passwordHash: 'unused' })
  await db.insert(schema.oauthClients).values({ id: 'client', redirectUris: ['https://client.example/callback'], scopes: ['read', 'write'] })
}

const grant = { clientId: 'client', userId: 'owner', scopes: ['read', 'write'], label: 'Turso test', resource: RESOURCE }

test('Turso config validates URLs without leaking credentials or selecting a local file', () => {
  assert.throws(() => getTursoConfig({}), /TURSO_DATABASE_URL is required/)
  for (const url of ['file:./local.db', 'wss://example.com', 'bad-url', 'https://user:secret@example.com']) {
    assert.throws(() => getTursoConfig({ TURSO_DATABASE_URL: url }), error => !error.message.includes('secret') && /TURSO_DATABASE_URL/.test(error.message))
  }
  assert.deepEqual(getTursoConfig({ TURSO_DATABASE_URL: 'libsql://example.turso.io', TURSO_AUTH_TOKEN: 'token' }), { url: 'libsql://example.turso.io', authToken: 'token' })
  assert.equal(getTursoConfig({ TURSO_DATABASE_URL: 'http://localhost:8080' }).authToken, undefined)
})

test('HTTP libSQL bootstrap is idempotent and maps SQLite JSON, dates, returning and constraints', async t => {
  const { mock, client, db } = await database(t)
  await createTursoDatabase(client)
  await seed(db)
  const [created] = await db.insert(schema.rangkaItems).values({
    id: 'rangka-1', userId: 'owner', slug: 'turso', title: 'Turso', type: 'markdown', contentPath: 'rangka/1', metadata: { tags: ['remote'] },
  }).returning()
  assert.deepEqual(created.metadata, { tags: ['remote'] })
  assert.ok(created.createdAt instanceof Date)
  assert.equal((await db.select().from(schema.rangkaItems).where(eq(schema.rangkaItems.id, created.id)).get()).title, 'Turso')
  await assert.rejects(() => db.insert(schema.rangkaItems).values({ ...created, id: 'rangka-2' }))
  await assert.rejects(() => db.insert(schema.apiTokens).values({ id: 'bad', userId: 'absent', name: 'bad', tokenHash: 'bad' }))
  await db.delete(schema.users).where(eq(schema.users.id, 'owner'))
  assert.equal((await db.select().from(schema.rangkaItems)).length, 0, 'foreign-key cascade remains enforced')
  assert.ok(mock.requests > 0)
})

test('Turso migrates an imported legacy database before creating the new tables', async t => {
  const { db } = await database(t, async sqlite => {
    sqlite.exec(await readFile(new URL('./fixtures/pre-rangka-schema.sql', import.meta.url), 'utf8'))
    sqlite.exec(`INSERT INTO users (id, email, password_hash) VALUES ('owner', 'owner@test.local', 'unused');
      INSERT INTO artifacts (id, user_id, slug, title, type, content_path) VALUES ('legacy', 'owner', 'old-link', 'Legacy', 'markdown', 'old-key');
      INSERT INTO artifact_versions (id, artifact_id, version, content_path) VALUES ('v1', 'legacy', 1, 'old-version-key');`)
  })
  assert.equal((await db.select().from(schema.rangkaItems).get()).contentPath, 'old-key')
  assert.equal((await db.select().from(schema.rangkaVersions).get()).rangkaId, 'legacy')
  assert.equal((await db.all(sql`SELECT name FROM sqlite_master WHERE name = 'artifacts'`)).length, 0)
})

test('libSQL authorization codes are single use and refresh rotation has one winner', async t => {
  const { db } = await database(t)
  await seed(db)
  const code = await createAuthorizationCode(db, { ...grant, redirectUri: 'https://client.example/callback', codeChallenge: 'challenge' })
  const consumed = await Promise.all([consumeAuthorizationCode(db, code), consumeAuthorizationCode(db, code)])
  assert.equal(consumed.filter(result => result.ok).length, 1)
  const issued = await issueTokens(db, grant)
  const rotated = await Promise.all([
    rotateRefreshToken(db, issued.refreshToken, 'client', RESOURCE),
    rotateRefreshToken(db, issued.refreshToken, 'client', RESOURCE),
  ])
  assert.equal(rotated.filter(result => result.ok).length, 1)
  assert.equal((await db.select().from(schema.apiTokens)).length, 1)
  assert.equal((await db.select().from(schema.oauthTokens)).length, 1)
})

test('libSQL batches roll back token issuance when writing the grant fails', async t => {
  const { db, mock } = await database(t)
  await seed(db)
  mock.sqlite.exec(`CREATE TRIGGER fail_grant BEFORE INSERT ON oauth_tokens BEGIN SELECT RAISE(ABORT, 'injected failure'); END`)
  await assert.rejects(() => issueTokens(db, grant))
  assert.equal((await db.select().from(schema.apiTokens)).length, 0)
  assert.equal((await db.select().from(schema.oauthTokens)).length, 0)
})

test('libSQL device redemption rolls back on failure and concurrent retry has one winner', async t => {
  const { db, mock } = await database(t)
  await seed(db)
  const device = await createDeviceAuthorization(db, grant)
  const row = await findDeviceByUserCode(db, device.userCode)
  assert.equal((await approveDeviceAuthorization(db, row.id, 'owner', grant.scopes)).ok, true)
  mock.sqlite.exec(`CREATE TRIGGER fail_grant BEFORE INSERT ON oauth_tokens BEGIN SELECT RAISE(ABORT, 'injected failure'); END`)
  await assert.rejects(() => pollDeviceAuthorization(db, device.deviceCode, 'client', RESOURCE))
  assert.equal((await db.select().from(schema.apiTokens)).length, 0)
  assert.equal((await db.select().from(schema.oauthDeviceCodes).get()).consumedAt, null)
  mock.sqlite.exec('DROP TRIGGER fail_grant')
  const results = await Promise.all([
    pollDeviceAuthorization(db, device.deviceCode, 'client', RESOURCE),
    pollDeviceAuthorization(db, device.deviceCode, 'client', RESOURCE),
  ])
  assert.equal(results.filter(result => result.ok).length, 1)
  assert.equal((await db.select().from(schema.apiTokens)).length, 1)
  assert.equal((await db.select().from(schema.oauthTokens)).length, 1)
})
