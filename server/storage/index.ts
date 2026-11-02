import { promises as fs } from 'fs'
import { join, dirname } from 'path'

export interface StorageAdapter {
  save(key: string, data: Buffer | string): Promise<string>
  read(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string

  constructor(basePath: string = './data/files') {
    this.basePath = basePath
  }

  private getPath(key: string): string {
    return join(this.basePath, key)
  }

  async save(key: string, data: Buffer | string): Promise<string> {
    const fullPath = this.getPath(key)
    await fs.mkdir(dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, data)
    return fullPath
  }

  async read(key: string): Promise<Buffer> {
    const fullPath = this.getPath(key)
    return await fs.readFile(fullPath)
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getPath(key)
    try {
      await fs.unlink(fullPath)
    } catch (e) {
      // ignore if doesn't exist
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getPath(key)
    try {
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }
}

export const storage = new LocalStorageAdapter(process.env.STORAGE_PATH || './data/files')

export function createPortableStorage() {
  if (process.env.STORAGE_DRIVER === 's3') {
    return import('unstorage').then(({ createStorage }) => import('unstorage/drivers/s3').then(({ default: s3Driver }) => createStorage({
      driver: s3Driver({
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        endpoint: process.env.S3_ENDPOINT || '',
        region: process.env.S3_REGION || 'auto',
        bucket: process.env.S3_BUCKET || '',
      }),
    })))
  }
  if (process.env.STORAGE_DRIVER === 'r2-binding') {
    return import('unstorage').then(({ createStorage }) => import('unstorage/drivers/cloudflare-r2-binding').then(({ default: r2Driver }) => createStorage({ driver: r2Driver({ binding: process.env.R2_BINDING || 'ARTIFACTS' }) })))
  }
  return Promise.resolve(storage)
}
