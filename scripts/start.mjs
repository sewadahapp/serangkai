#!/usr/bin/env bun
/**
 * Starts the built Nitro server with the derived session key.
 *
 * Nuxt Auth Utils needs `NUXT_APP_SECRET` before the server module is loaded.
 * We derive it from `JWT_SECRET` (HKDF, domain-separated) so a default
 * deployment only needs ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET, and
 * SHARE_SECRET. An explicit NUXT_APP_SECRET still wins.
 */
import { deriveSessionSecret } from './session-secret.mjs'

if (!process.env.NUXT_APP_SECRET) {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    console.error('[serangkai] JWT_SECRET is required to derive the browser session key.')
    process.exit(1)
  }
  try {
    process.env.NUXT_APP_SECRET = await deriveSessionSecret(jwtSecret)
  } catch (error) {
    console.error(`[serangkai] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

// Preserve the previous cookie boundary: Secure in production, not on plain
// HTTP development servers. The value is declared in nuxt.config so this env
// override is honored at runtime.
if (process.env.NUXT_SESSION_COOKIE_SECURE === undefined) {
  process.env.NUXT_SESSION_COOKIE_SECURE = process.env.NODE_ENV === 'production' ? 'true' : 'false'
}

await import('../.output/server/index.mjs')
