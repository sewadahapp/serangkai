export type StorageProvider = 'local' | 's3' | 'r2-binding'

export interface StorageConfig {
  provider: StorageProvider
  durable: boolean
  requiredEnvironment: string[]
}

export function getStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  switch (env.STORAGE_DRIVER) {
    case 's3':
      return { provider: 's3', durable: true, requiredEnvironment: ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_ENDPOINT', 'S3_BUCKET'] }
    case 'r2-binding':
      return { provider: 'r2-binding', durable: true, requiredEnvironment: ['R2_BINDING'] }
    default:
      return { provider: 'local', durable: true, requiredEnvironment: ['STORAGE_PATH'] }
  }
}
