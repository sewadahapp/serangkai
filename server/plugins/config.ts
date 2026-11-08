import { useRuntimeConfig } from 'nitropack/runtime'
import { getServerConfig } from '../utils/config'

/**
 * Fail fast instead of serving with insecure development defaults.
 *
 * Nuxt Auth Utils seals browser sessions with a key derived from `appSecret`.
 * Production derives it from JWT_SECRET before startup (scripts/start.mjs);
 * this check surfaces a missing/too-short value at boot rather than on the
 * first login attempt.
 */
export default defineNitroPlugin(() => {
  try {
    const config = getServerConfig()
    if (config.production) {
      const appSecret = String(useRuntimeConfig().appSecret || '')
      if (appSecret.length < 32) {
        throw new Error('The browser session secret is missing. Start the server with `bun run start` (or set NUXT_APP_SECRET to at least 32 characters).')
      }
    }
  } catch (error: any) {
    console.error(`[serangkai] Invalid configuration: ${error.message}`)
    throw error
  }
})
