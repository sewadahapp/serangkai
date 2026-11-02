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
