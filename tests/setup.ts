// Test-only defaults. Real deployments derive NUXT_APP_SECRET from JWT_SECRET
// (see scripts/start.mjs) and keep Secure cookies enabled in production.
process.env.NUXT_APP_SECRET ??= '6a1f0d4c9b2e7358c4a1f0d4c9b2e7358c4a1f0d4c9b2e7358c4a1f0d4c9b2e7'
process.env.NUXT_SESSION_COOKIE_SECURE ??= 'false'

// A developer's local .env may contain a one-time owner migration id.
// Tests create their own databases and must not inherit it.
delete process.env.SERANGKAI_MIGRATION_OWNER_USER_ID

// Never let a developer's remote database configuration reach test servers.
process.env.DATABASE_DRIVER = 'sqlite'
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
