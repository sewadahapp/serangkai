const memory = new Map<string, Buffer>()

/** Preview fallback only. Production Workers must replace this with R2. */
export const storage = {
  async save(key: string, data: Buffer | string) { memory.set(key, Buffer.from(data)); return key },
  async read(key: string) { const value = memory.get(key); if (!value) throw new Error('File not found'); return value },
  async delete(key: string) { memory.delete(key) },
  async exists(key: string) { return memory.has(key) },
}

export function getRequestStorage(event: any) {
  const cloudflare = event?.req?.runtime?.cloudflare || event?.context?.cloudflare || event?.context?._platform?.cloudflare
  const binding = cloudflare?.env?.ARTIFACTS || cloudflare?.env?.R2 || cloudflare?.env?.R2_BINDING
  if (binding) {
    if (!event.context.r2Storage) {
      event.context.r2Storage = {
        async save(key: string, data: Buffer | string) { await binding.put(key, typeof data === 'string' ? data : new Uint8Array(data)); return key },
        async read(key: string) { const object = await binding.get(key); if (!object) throw new Error('File not found'); return Buffer.from(await object.arrayBuffer()) },
        async delete(key: string) { await binding.delete(key) },
        async exists(key: string) { return Boolean(await binding.head(key)) },
      }
    }
    return event.context.r2Storage
  }
  return storage
}
