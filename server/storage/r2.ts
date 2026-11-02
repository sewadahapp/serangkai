export interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array | string): Promise<unknown>
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>
  delete(key: string | string[]): Promise<void>
  head(key: string): Promise<unknown | null>
}

export function createR2Storage(binding: R2Like) {
  return {
    async save(key: string, data: Buffer | string) { await binding.put(key, typeof data === 'string' ? data : new Uint8Array(data)); return key },
    async read(key: string) { const object = await binding.get(key); if (!object) throw new Error('File not found'); return Buffer.from(await object.arrayBuffer()) },
    async delete(key: string) { await binding.delete(key) },
    async exists(key: string) { return Boolean(await binding.head(key)) },
  }
}
