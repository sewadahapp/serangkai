import { useStorage } from 'nitropack/runtime'
import { getServerConfig } from '../utils/config'

declare const __SERANGKAI_CLOUDFLARE__: boolean

/**
 * Mounts the artifact store once at startup.
 *
 * Nitro's storage layer is unstorage, so the same keys work against the local
 * filesystem, an R2 binding, or S3-compatible object storage. The driver is
 * selected at runtime so credentials and paths never get baked into the build.
 */
export default defineNitroPlugin(async () => {
  const storage = useStorage()
  const config = getServerConfig()

  if (__SERANGKAI_CLOUDFLARE__) {
    const { default: r2Driver } = await import('unstorage/drivers/cloudflare-r2-binding')
    const driver = r2Driver({ binding: config.r2Binding })
    try {
      await driver.getInstance()
      storage.mount('artifacts', driver)
    } catch {
      // Local Workers tests may not define an R2 binding. Keep the app usable
      // with an explicit ephemeral fallback instead of failing every request.
      const { default: memoryDriver } = await import('unstorage/drivers/memory')
      storage.mount('artifacts', memoryDriver())
      console.warn(`[serangkai] R2 binding "${config.r2Binding}" is unavailable; using ephemeral memory storage.`)
    }
    return
  }

  if (config.storageDriver === 's3') {
    const { default: s3Driver } = await import('unstorage/drivers/s3')
    storage.mount('artifacts', s3Driver(config.s3))
    return
  }

  const { default: fsDriver } = await import('unstorage/drivers/fs')
  storage.mount('artifacts', fsDriver({ base: config.storagePath }))
})
