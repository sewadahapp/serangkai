#!/usr/bin/env bun
/**
 * Prints the session secret derived from JWT_SECRET.
 *
 * Docker and `bun run start` derive this automatically. Use this script only
 * for platforms whose runtime entry point cannot be wrapped (for example a
 * Workers deployment), then set the printed value as NUXT_APP_SECRET.
 */
import { deriveSessionSecret } from './session-secret.mjs'

const jwtSecret = process.argv[2] || process.env.JWT_SECRET
if (!jwtSecret) {
  console.error('Usage: bun scripts/derive-session-secret.mjs <JWT_SECRET>')
  console.error('       (or set JWT_SECRET in the environment)')
  process.exit(1)
}

try {
  console.log(await deriveSessionSecret(jwtSecret))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
