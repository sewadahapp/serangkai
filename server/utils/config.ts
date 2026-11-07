/**
 * Central runtime configuration.
 *
 * Environment names are intentionally the existing ones (JWT_SECRET,
 * SHARE_SECRET, DATABASE_PATH, STORAGE_PATH, ...), so existing deployments do
 * not need to rename anything. Validation happens once, at startup.
 */
export type StorageDriver = 'local' | 's3' | 'r2-binding'

export interface ServerConfig {
  production: boolean
  jwtSecret: string
  shareSecret: string
  databasePath: string
  storageDriver: StorageDriver
  storagePath: string
  r2Binding: string
  s3: {
    accessKeyId: string
    secretAccessKey: string
    endpoint: string
    region: string
    bucket: string
  }
  publicBaseUrl: string
}

let cached: ServerConfig | undefined

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required in production.`)
  return value
}

function secret(name: string) {
  const value = required(name)
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters in production.`)
  return value
}

export function getServerConfig(): ServerConfig {
  if (cached) return cached

  const production = process.env.NODE_ENV === 'production'
  const jwtSecret = production ? secret('JWT_SECRET') : (process.env.JWT_SECRET || 'dev-secret-change-in-production')
  const shareSecret = production
    ? secret('SHARE_SECRET')
    : (process.env.SHARE_SECRET || jwtSecret || 'dev-share-secret-change-me')

  const storageDriver = (process.env.STORAGE_DRIVER || 'local') as StorageDriver
  if (!['local', 's3', 'r2-binding'].includes(storageDriver)) {
    throw new Error(`Unknown STORAGE_DRIVER "${storageDriver}". Use local, s3, or r2-binding.`)
  }

  const s3 = {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'auto',
    bucket: process.env.S3_BUCKET || '',
  }

  if (storageDriver === 's3') {
    for (const [name, value] of Object.entries(s3)) {
      if (!value) throw new Error(`S3_${name.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()} is required when STORAGE_DRIVER=s3.`)
    }
  }

  cached = {
    production,
    jwtSecret,
    shareSecret,
    databasePath: process.env.DATABASE_PATH || './data/serangkai.db',
    storageDriver,
    storagePath: process.env.STORAGE_PATH || './data/files',
    r2Binding: process.env.R2_BINDING || 'ARTIFACTS',
    s3,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  }
  return cached
}
