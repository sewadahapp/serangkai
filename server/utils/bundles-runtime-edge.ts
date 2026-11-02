export function extractBundle() {
  throw new Error('ZIP bundle uploads require the Node/container runtime')
}

export function bundleMimeType(path: string) {
  const ext = path.toLowerCase().split('.').pop()
  return ({ html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8' } as Record<string, string>)[ext || ''] || 'application/octet-stream'
}
