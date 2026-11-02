import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createR2Storage } from '../server/storage/r2.ts'

test('R2 adapter preserves binary objects through its contract', async () => {
  const objects = new Map()
  const binding = {
    async put(key, value) { objects.set(key, Buffer.from(value)) },
    async get(key) { const value = objects.get(key); return value ? { arrayBuffer: async () => value } : null },
    async delete(key) { objects.delete(key) },
    async head(key) { return objects.has(key) ? {} : null },
  }
  const storage = createR2Storage(binding)
  await storage.save('demo.bin', Buffer.from([0, 255, 2]))
  assert.equal(await storage.exists('demo.bin'), true)
  assert.deepEqual([...await storage.read('demo.bin')], [0, 255, 2])
  await storage.delete('demo.bin')
  assert.equal(await storage.exists('demo.bin'), false)
})
