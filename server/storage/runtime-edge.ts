const unsupported = () => {
  throw new Error('Cloudflare storage requires STORAGE_DRIVER=r2-binding and request-scoped R2 wiring')
}

export const storage = {
  save: unsupported,
  read: unsupported,
  delete: unsupported,
  exists: unsupported,
}
