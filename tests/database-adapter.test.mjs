import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDatabaseProvider, initializeD1Schema, getRequestDatabase } from '../server/db/adapter.ts'
import { BOOTSTRAP_STATEMENTS } from '../server/db/bootstrap.ts'

// Derived, not hardcoded: a new table must not require editing a magic number,
// and the count assertion below still catches a statement that never runs.
const TABLE_COUNT = BOOTSTRAP_STATEMENTS.length

test('selects SQLite by default and D1 explicitly', () => {
  assert.equal(getDatabaseProvider({}), 'sqlite')
  assert.equal(getDatabaseProvider({ DATABASE_DRIVER: 'd1' }), 'd1')
})

test('initializes a D1-compatible binding through prepared statements', async () => {
  const calls = []
  const client = { prepare(sql) { calls.push(sql); return { run: async () => ({ success: true }) } } }
  await initializeD1Schema(client)
  assert.equal(calls.length, TABLE_COUNT)
  assert.ok(calls.every(sql => sql.startsWith('CREATE TABLE IF NOT EXISTS')))
})

test('uses D1 batch when the binding provides it', async () => {
  let batchSize = 0
  const client = { prepare: () => ({ run: async () => ({}) }), batch: async statements => { batchSize = statements.length; return [] } }
  await initializeD1Schema(client)
  assert.equal(batchSize, TABLE_COUNT)
})

test('resolves and caches a request-scoped Cloudflare D1 binding', async () => {
  const calls = []
  const binding = {
    prepare(sql) {
      calls.push(sql)
      return {
        run: async () => ({}),
        bind: () => ({ run: async () => ({}), all: async () => ({ results: [] }) }),
      }
    },
  }
  const event = { context: { cloudflare: { env: { DB: binding } } } }
  const first = await getRequestDatabase(event)
  const afterFirstRequest = calls.length
  const second = await getRequestDatabase(event)
  assert.equal(first, second)
  assert.ok(afterFirstRequest >= 5, 'the bootstrap schema must run')
  assert.equal(calls.length, afterFirstRequest, 'schema work must not repeat per request')
})
