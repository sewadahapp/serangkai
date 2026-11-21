import { and, eq } from 'drizzle-orm'
import { rangkaItems } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { isValidBundleViewKey, isValidShareKey } from '../../../utils/share'
import { bundleMimeType, isBundleDocument, readBundleFile } from '../../../utils/bundles'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const slug = getRouterParam(event, 'slug')
  let path = getRouterParam(event, 'path') || ''
  const rangka = await db.select().from(rangkaItems).where(and(eq(rangkaItems.slug, slug || ''), eq(rangkaItems.type, 'bundle'))).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Bundle not found' })

  // An access key may lead the path (`~<key>/index.html`) so that relative
  // asset links keep it; see signBundleViewKey. `?k=` still works for links
  // made before keys moved into the path.
  let key = String(getQuery(event).k || '')
  if (path.startsWith('~')) {
    const slash = path.indexOf('/')
    key = slash === -1 ? path.slice(1) : path.slice(1, slash)
    path = slash === -1 ? '' : path.slice(slash + 1)
  }
  // The router drops a trailing slash, so read it from the request URL.
  if (path === '' || getRequestURL(event).pathname.endsWith('/')) path = path ? `${path.replace(/\/+$/, '')}/index.html` : 'index.html'

  const user = event.context.user
  // The owner's session, or one of the owner's API tokens that may read, like
  // every other read endpoint (requireScope). A write-only token may not.
  const token = (event.context as any).apiToken
  const tokenMayRead = !token || token.scopes.includes('read') || token.scopes.includes('full')
  const isOwner = !!user && user.id === rangka.userId && tokenMayRead
  const viaViewKey = isValidBundleViewKey(rangka.id, key)
  if (rangka.visibility === 'private' && !isOwner && !viaViewKey) {
    if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
    throw createError({ statusCode: 403, message: user.id === rangka.userId ? 'API token requires read scope' : 'Forbidden' })
  }
  if (rangka.visibility === 'unlisted' && !isOwner && !viaViewKey && !isValidShareKey(rangka.id, key)) {
    throw createError({ statusCode: 404, message: 'Bundle not found' })
  }

  // Storage treats `:` as a separator like `/`, so `..:..:other` would escape
  // the bundle prefix; a colon is never part of a valid bundle path.
  if (path.includes('\0') || path.includes('\\') || path.includes(':') || path.startsWith('/') || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  // Only web file types are served, including from bundles uploaded before
  // the upload refused other types.
  const kind = bundleMimeType(path)
  if (!kind) throw createError({ statusCode: 404, message: 'File not found' })

  try {
    const content = await readBundleFile(`${rangka.userId}/${rangka.id}/bundle`, path)
    setHeader(event, 'Content-Type', kind)
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    // The path can hold an access key: never send it on as a referrer.
    setHeader(event, 'Referrer-Policy', 'no-referrer')
    // Bundle assets share the app origin, so every document-like file needs the
    // sandbox policy. `endsWith('.html')` alone missed uppercase extensions
    // (`EVIL.HTML`) and SVG, and both execute script when opened directly.
    // Inline <style> and <script> are allowed as for HTML rangka: the sandbox
    // (an opaque origin with no network) is the boundary, not the inline ban.
    if (isBundleDocument(kind)) {
      setHeader(event, 'Content-Security-Policy', "sandbox allow-scripts; default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; frame-ancestors 'self'; form-action 'none'")
    }
    return content
  } catch {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
})
