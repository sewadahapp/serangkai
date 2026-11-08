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
    process.env.ADMIN_USERNAME = '${env.ADMIN_USERNAME ?? ''}'
    process.env.ADMIN_PASSWORD = '${env.ADMIN_PASSWORD ?? ''}'
    process.env.SERANGKAI_ALLOW_EPHEMERAL_STORAGE = '${env.SERANGKAI_ALLOW_EPHEMERAL_STORAGE ?? ''}'
    delete process.env.STORAGE_DRIVER
    try {
      const { getServerConfig } = await import('./server/utils/config.ts')
      const config = getServerConfig()
      console.log(JSON.stringify({
        ok: true,
        production: config.production,
        allowEphemeralStorage: config.allowEphemeralStorage,
        adminUsername: config.adminUsername,
      }))
    } catch (error) {
      console.log(JSON.stringify({ ok: false, message: error.message }))
    }
  `
  return spawnSync('bun', ['-e', script], { encoding: 'utf8' })
}

const valid = {
  JWT_SECRET: 'j'.repeat(48),
  SHARE_SECRET: 's'.repeat(48),
  ADMIN_USERNAME: 'owner',
  ADMIN_PASSWORD: 'correct horse battery',
}

test('production refuses to start without JWT_SECRET', () => {
  const result = run({ ...valid, JWT_SECRET: '' })
  assert.match(result.stdout, /JWT_SECRET is required/)
})

test('production refuses weak or missing SHARE_SECRET', () => {
  const result = run({ ...valid, SHARE_SECRET: 'short' })
  assert.match(result.stdout, /SHARE_SECRET must be at least 32 characters/)
})

test('production requires the owner credentials', () => {
  assert.match(run({ ...valid, ADMIN_USERNAME: '' }).stdout, /ADMIN_USERNAME is required/)
  assert.match(run({ ...valid, ADMIN_PASSWORD: '' }).stdout, /ADMIN_PASSWORD is required/)
  assert.match(run({ ...valid, ADMIN_PASSWORD: 'short' }).stdout, /ADMIN_PASSWORD must be at least 8 characters/)
  assert.match(run({ ...valid, ADMIN_USERNAME: 'bad name!' }).stdout, /ADMIN_USERNAME must be/)
})

test('production accepts strong secrets and owner credentials', () => {
  const result = run(valid)
  assert.match(result.stdout, /"ok":true/)
  assert.match(result.stdout, /"production":true/)
  assert.match(result.stdout, /"adminUsername":"owner"/)
})

test('production never allows the ephemeral storage fallback', () => {
  const result = run({ ...valid, SERANGKAI_ALLOW_EPHEMERAL_STORAGE: 'true' })
  assert.match(result.stdout, /"ok":true/)
  assert.match(result.stdout, /"allowEphemeralStorage":false/)
})
