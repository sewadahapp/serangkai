// Test-only defaults. Real deployments derive NUXT_APP_SECRET from JWT_SECRET
// (see scripts/start.mjs) and keep Secure cookies enabled in production.
process.env.NUXT_APP_SECRET ??= '6a1f0d4c9b2e7358c4a1f0d4c9b2e7358c4a1f0d4c9b2e7358c4a1f0d4c9b2e7'
process.env.NUXT_SESSION_COOKIE_SECURE ??= 'false'
