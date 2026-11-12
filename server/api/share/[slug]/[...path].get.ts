import { and, eq } from 'drizzle-orm'
import { artifacts } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireUser } from '../../../utils/require-auth'
import { isValidShareKey } from '../../../utils/share'
import { bundleMimeType } from '../../../utils/bundles'
import { readArtifactBytes } from '../../../utils/artifact-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const slug = getRouterParam(event, 'slug')
  const path = getRouterParam(event, 'path') || 'index.html'
  const artifact = await db.select().from(artifacts).where(and(eq(artifacts.slug, slug || ''), eq(artifacts.type, 'bundle'))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Bundle not found' })
  const key = String(getQuery(event).k || '')
  if (artifact.visibility === 'private') { requireUser(event); if (event.context.user.id !== artifact.userId) throw createError({ statusCode: 403, message: 'Forbidden' }) }
  if (artifact.visibility === 'unlisted' && !isValidShareKey(artifact.id, key)) throw createError({ statusCode: 404, message: 'Bundle not found' })
  // Storage treats `:` as a separator like `/`, so `..:..:other` would escape
  // the bundle prefix; a colon is never part of a valid bundle path.
  if (path.includes('\0') || path.includes('\\') || path.includes(':') || path.startsWith('/') || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  try {
    const content = await readArtifactBytes(`${artifact.userId}/${artifact.id}/bundle/${path}`)
    setHeader(event, 'Content-Type', bundleMimeType(path))
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    // Bundle assets share the app origin, so every document-like file needs the
    // sandbox policy. `endsWith('.html')` alone missed uppercase extensions
    // (`EVIL.HTML`) and SVG, and both execute script when opened directly.
    const kind = bundleMimeType(path)
    if (kind.startsWith('text/html') || kind.startsWith('image/svg')) {
      setHeader(event, 'Content-Security-Policy', "sandbox allow-scripts; default-src 'self'; connect-src 'none'; frame-ancestors 'self'; form-action 'none'")
    }
    return content
  } catch {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
})
