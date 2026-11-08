import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

/**
 * Config is cached per process, so each production case runs in a fresh
 * process and only prints the resulting error.
 */
function run(env) {
  const script = `
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = '${env.JWT_SECRET ?? ''}'
    process.env.SHARE_SECRET = '${env.SHARE_SECRET ?? ''}'
    process.env.SERANGKAI_ALLOW_EPHEMERAL_STORAGE = '${env.SERANGKAI_ALLOW_EPHEMERAL_STORAGE ?? ''}'
    delete process.env.STORAGE_DRIVER
    try {
      const { getServerConfig } = await import('./server/utils/config.ts')
      const config = getServerConfig()
      console.log(JSON.stringify({ ok: true, production: config.production, allowEphemeralStorage: config.allowEphemeralStorage }))
    } catch (error) {
      console.log(JSON.stringify({ ok: false, message: error.message }))
    }
  `
  return spawnSync('bun', ['-e', script], { encoding: 'utf8' })
}

test('production refuses to start without JWT_SECRET', () => {
  const result = run({ SHARE_SECRET: 's'.repeat(48) })
  assert.match(result.stdout, /JWT_SECRET is required/)
})

test('production refuses weak or missing SHARE_SECRET', () => {
  const result = run({ JWT_SECRET: 'j'.repeat(48), SHARE_SECRET: 'short' })
  assert.match(result.stdout, /SHARE_SECRET must be at least 32 characters/)
})

test('production accepts strong secrets', () => {
  const result = run({ JWT_SECRET: 'j'.repeat(48), SHARE_SECRET: 's'.repeat(48) })
  assert.match(result.stdout, /"ok":true/)
  assert.match(result.stdout, /"production":true/)
})

test('production never allows the ephemeral storage fallback', () => {
  const result = run({
    JWT_SECRET: 'j'.repeat(48),
    SHARE_SECRET: 's'.repeat(48),
    SERANGKAI_ALLOW_EPHEMERAL_STORAGE: 'true',
  })
  assert.match(result.stdout, /"ok":true/)
  assert.match(result.stdout, /"allowEphemeralStorage":false/)
})
