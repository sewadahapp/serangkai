import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStorageConfig } from '../server/storage/config.ts'

test('defaults to durable local filesystem storage', () => {
  assert.deepEqual(getStorageConfig({}), { provider: 'local', durable: true, requiredEnvironment: ['STORAGE_PATH'] })
})

test('configures S3-compatible storage for R2, S3, and Vercel object stores', () => {
  const config = getStorageConfig({ STORAGE_DRIVER: 's3' })
  assert.equal(config.provider, 's3')
  assert.equal(config.durable, true)
  assert.ok(config.requiredEnvironment.includes('S3_ENDPOINT'))
})

test('configures native Cloudflare R2 binding storage', () => {
  const config = getStorageConfig({ STORAGE_DRIVER: 'r2-binding', R2_BINDING: 'ARTIFACTS' })
  assert.deepEqual(config, { provider: 'r2-binding', durable: true, requiredEnvironment: ['R2_BINDING'] })
})
