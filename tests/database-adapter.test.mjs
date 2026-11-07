import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getDatabaseProvider, initializeD1Schema, getRequestDatabase } from '../server/db/adapter.ts'

test('selects SQLite by default and D1 explicitly', () => {
  assert.equal(getDatabaseProvider({}), 'sqlite')
  assert.equal(getDatabaseProvider({ DATABASE_DRIVER: 'd1' }), 'd1')
})

test('initializes a D1-compatible binding through prepared statements', async () => {
  const calls = []
  const client = { prepare(sql) { calls.push(sql); return { run: async () => ({ success: true }) } } }
  await initializeD1Schema(client)
  assert.equal(calls.length, 5)
  assert.ok(calls.every(sql => sql.startsWith('CREATE TABLE IF NOT EXISTS')))
})

test('uses D1 batch when the binding provides it', async () => {
  let batchSize = 0
  const client = { prepare: () => ({ run: async () => ({}) }), batch: async statements => { batchSize = statements.length; return [] } }
  await initializeD1Schema(client)
  assert.equal(batchSize, 5)
})

test('resolves and caches a request-scoped Cloudflare D1 binding', async () => {
  const calls = []
  const binding = { prepare(sql) { calls.push(sql); return { run: async () => ({}) } } }
  const event = { context: { cloudflare: { env: { DB: binding } } } }
  const first = await getRequestDatabase(event)
  const second = await getRequestDatabase(event)
  assert.equal(first, second)
  assert.equal(calls.length, 5)
})
