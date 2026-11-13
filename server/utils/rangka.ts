import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { rangkaItems } from '../db/schema'

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const rangkaTypes = ['markdown', 'html', 'javascript', 'pdf', 'image', 'json', 'bundle'] as const
export type RangkaType = typeof rangkaTypes[number]

export function inferRangkaType(filename: string, mimeType = ''): RangkaType {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.zip') || mimeType.includes('zip')) return 'bundle'
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(lower)) return 'image'
  if (lower.endsWith('.json') || mimeType === 'application/json') return 'json'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.ts')) return 'javascript'
  return 'markdown'
}

/**
 * Rules for rangka whose content arrives as a text string (JSON create and
 * update over REST and MCP). Bundles and PDFs are binary and are only valid
 * through the multipart upload, which extracts bundles and keeps raw bytes; an
 * image is accepted as text only when it is SVG markup, and it is then labelled
 * `image/svg+xml` so it renders. Returns an error message, or the metadata to
 * store.
 */
export function checkTextRangka(type: string, content: string, slug: string):
  | { ok: true; metadata: Record<string, any> }
  | { ok: false; message: string } {
  if (type === 'bundle' || type === 'pdf') {
    return { ok: false, message: `${type} rangka are binary. Upload the file with POST /api/rangka/upload instead of sending text content.` }
  }
  if (type === 'image') {
    const head = content.trimStart().slice(0, 4096).toLowerCase()
    const svg = head.startsWith('<svg') || ((head.startsWith('<?xml') || head.startsWith('<!--') || head.startsWith('<!doctype svg')) && head.includes('<svg'))
    if (!svg) {
      return { ok: false, message: 'Image rangka sent as text must be SVG markup. Upload raster images with POST /api/rangka/upload.' }
    }
    return { ok: true, metadata: { mimeType: 'image/svg+xml', filename: `${slug}.svg` } }
  }
  return { ok: true, metadata: {} }
}

export function makeSlug(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'rangka'}-${nanoid(6)}`
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
    .slice(0, 80) || 'rangka'

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${nanoid(6)}`
    const existing = await db.select({ id: rangkaItems.id }).from(rangkaItems).where(eq(rangkaItems.slug, candidate)).get()
    if (!existing) return candidate
  }
  return `${base}-${nanoid(12)}`
}
