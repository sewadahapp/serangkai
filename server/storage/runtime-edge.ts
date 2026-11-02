const memory = new Map<string, Buffer>()

/** Preview fallback only. Production Workers must replace this with R2. */
export const storage = {
  async save(key: string, data: Buffer | string) { memory.set(key, Buffer.from(data)); return key },
  async read(key: string) { const value = memory.get(key); if (!value) throw new Error('File not found'); return value },
  async delete(key: string) { memory.delete(key) },
  async exists(key: string) { return memory.has(key) },
}
