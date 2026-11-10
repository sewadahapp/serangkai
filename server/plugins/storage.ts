import { useStorage } from 'nitropack/runtime'
import { getServerConfig, type ServerConfig } from '../utils/config'

declare const __SERANGKAI_CLOUDFLARE__: boolean

/**
 * Mounts the artifact store once at startup.
 *
 * Nitro's storage layer is unstorage, so the same keys work against the local
 * filesystem, an R2 binding, or S3-compatible object storage. The driver is
 * selected at runtime so credentials and paths never get baked into the build.
 * On Cloudflare the default stays the native R2 binding; `STORAGE_DRIVER=s3`
 * selects an external S3-compatible provider such as Backblaze B2 instead.
 *
 * Every failure path mounts a driver whose operations throw. Leaving the mount
 * empty would let unstorage's in-memory default absorb uploads silently —
 * Nitro swallows plugin errors on Workers, so a throw alone does not stop the
 * worker from serving. Losing an artifact to a recycled isolate is worse than
 * a loud 500.
 */
export default defineNitroPlugin(async (nitroApp) => {
  const storage = useStorage()
  let config: ServerConfig
  try {
    config = getServerConfig()
  } catch (error) {
    storage.mount('artifacts', unavailableDriver(error))
    throw error
  }

  if (__SERANGKAI_CLOUDFLARE__) {
    const selected = process.env.STORAGE_DRIVER || 'r2-binding'
    if (selected === 's3') {
      await mountS3(storage, config)
      return
    }
    if (selected !== 'r2-binding') {
      const error = new Error(`STORAGE_DRIVER "${selected}" is not available on Cloudflare Workers. Use r2-binding or s3.`)
      storage.mount('artifacts', unavailableDriver(error))
      throw error
    }
    const { default: r2Driver } = await import('unstorage/drivers/cloudflare-r2-binding')
    try {
      const driver = r2Driver({ binding: config.r2Binding })
      await driver.getInstance()
      storage.mount('artifacts', driver)
    } catch (error: any) {
      // Silently accepting writes into an in-memory driver loses every artifact
      // on the next isolate and makes a misconfigured deployment look healthy.
      // Tests and local previews can opt in explicitly; production cannot.
      if (config.allowEphemeralStorage) {
        const { default: memoryDriver } = await import('unstorage/drivers/memory')
        storage.mount('artifacts', memoryDriver())
        console.warn(`[serangkai] R2 binding "${config.r2Binding}" is unavailable; SERANGKAI_ALLOW_EPHEMERAL_STORAGE is set, using ephemeral memory storage.`)
        return
      }
      console.error(`[serangkai] R2 binding "${config.r2Binding}" is unavailable: ${error?.message || error}`)
      const failure = new Error(`R2 binding "${config.r2Binding}" is required. Configure the binding, or set SERANGKAI_ALLOW_EPHEMERAL_STORAGE=true for local development and tests only.`)
      storage.mount('artifacts', unavailableDriver(failure))
      throw failure
    }
    return
  }

  if (config.storageDriver === 's3') {
    await mountS3(storage, config)
    return
  }
  if (config.storageDriver === 'r2-binding') {
    throw new Error('STORAGE_DRIVER=r2-binding is only available on Cloudflare Workers. Use local or s3 here.')
  }

  const { default: fsDriver } = await import('unstorage/drivers/fs')
  storage.mount('artifacts', fsDriver({ base: config.storagePath }))
})

/**
 * S3 has no ephemeral fallback: a misconfigured bucket fails every storage
 * operation with the configuration error. The connection itself is probed on
 * first use, because Workers forbid network I/O during plugin initialization.
 */
async function mountS3(storage: ReturnType<typeof useStorage>, config: ServerConfig) {
  try {
    const { s3Driver } = await import('../utils/s3-driver')
    storage.mount('artifacts', s3Driver(config.s3))
  } catch (error: any) {
    console.error(`[serangkai] S3 storage is misconfigured: ${error?.message || error}`)
    storage.mount('artifacts', unavailableDriver(error))
    throw error
  }
}

/** A driver that fails loudly on every operation, with the cause attached. */
function unavailableDriver(error: unknown) {
  const fail = () => { throw error }
  return {
    name: 'serangkai-unavailable',
    getItem: fail,
    getItemRaw: fail,
    setItem: fail,
    setItemRaw: fail,
    hasItem: fail,
    removeItem: fail,
    getKeys: fail,
  }
}