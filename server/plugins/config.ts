import { getServerConfig } from '../utils/config'

/** Fail fast instead of serving with insecure development defaults. */
export default defineNitroPlugin(() => {
  try {
    getServerConfig()
  } catch (error: any) {
    console.error(`[serangkai] Invalid configuration: ${error.message}`)
    throw error
  }
})
