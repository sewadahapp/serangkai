import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deriveSessionSecret } from '../scripts/session-secret.mjs'

const root = 'j'.repeat(48)

test('derives a stable, domain-separated session secret from JWT_SECRET', async () => {
  const first = await deriveSessionSecret(root)
  const second = await deriveSessionSecret(root)
  assert.equal(first, second, 'the secret must be stable across restarts')
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.notEqual(first, root, 'the derived key must not equal the root secret')
  assert.notEqual(first, await deriveSessionSecret('k'.repeat(48)))
})

test('refuses to derive from a missing or short root secret', async () => {
  await assert.rejects(() => deriveSessionSecret(''), /at least 32 characters/)
  await assert.rejects(() => deriveSessionSecret('short'), /at least 32 characters/)
})
