import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRequestStorage } from '../server/storage/runtime-edge.ts'

test('request-scoped R2 resolver uses the Cloudflare binding and caches the adapter', async () => {
  const objects = new Map()
  const binding = {
    async put(key, value) { objects.set(key, Buffer.from(value)) },
    async get(key) { const value = objects.get(key); return value ? { arrayBuffer: async () => value } : null },
    async delete(key) { objects.delete(key) },
    async head(key) { return objects.has(key) ? {} : null },
  }
  const event = { context: {}, req: { runtime: { cloudflare: { env: { ARTIFACTS: binding } } } } }
  const first = getRequestStorage(event)
  const second = getRequestStorage(event)
  assert.equal(first, second)
  await first.save('report.bin', Buffer.from([1, 2, 255]))
  assert.equal(await first.exists('report.bin'), true)
  assert.deepEqual([...await first.read('report.bin')], [1, 2, 255])
  await first.delete('report.bin')
  assert.equal(await first.exists('report.bin'), false)
})
