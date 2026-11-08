import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { artifacts } from '../db/schema'

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

/**
 * Returns a slug that is free across the whole table.
 *
 * Share URLs resolve a slug without a user scope, so slugs are globally
 * unique (see `server/db/migrations.ts`). Callers must never create a row that
 * would shadow another user's identifier.
 */
export async function reserveSlug(db: any, requested: string) {
  const base = requested
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'artifact'

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${nanoid(6)}`
    const existing = await db.select({ id: artifacts.id }).from(artifacts).where(eq(artifacts.slug, candidate)).get()
    if (!existing) return candidate
  }
  return `${base}-${nanoid(12)}`
}
