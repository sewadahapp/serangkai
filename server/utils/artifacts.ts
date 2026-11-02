import { nanoid } from 'nanoid'

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const artifactTypes = ['markdown', 'html', 'javascript', 'pdf', 'image', 'json', 'bundle'] as const
export type ArtifactType = typeof artifactTypes[number]

export function inferArtifactType(filename: string, mimeType = ''): ArtifactType {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.zip') || mimeType.includes('zip')) return 'bundle'
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(lower)) return 'image'
  if (lower.endsWith('.json') || mimeType === 'application/json') return 'json'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.ts')) return 'javascript'
  return 'markdown'
}

export function makeSlug(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'artifact'}-${nanoid(6)}`
}
