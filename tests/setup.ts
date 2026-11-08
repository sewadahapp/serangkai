// Test-only defaults. Real deployments derive NUXT_APP_SECRET from JWT_SECRET
// (see scripts/start.mjs) and keep Secure cookies enabled in production.
process.env.NUXT_APP_SECRET ??= '6a1f0d4c9b2e7358c4a1f0d4c9b2e7358c4a1f0d4c9b2e7358c4a1f0d4c9b2e7'
process.env.NUXT_SESSION_COOKIE_SECURE ??= 'false'

// A developer's local .env may contain a one-time owner migration id.
// Tests create their own databases and must not inherit it.
delete process.env.SERANGKAI_MIGRATION_OWNER_USER_ID
