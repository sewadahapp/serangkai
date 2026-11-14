import { and, eq } from 'drizzle-orm'
import { rangkaItems } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireUser } from '../../../utils/require-auth'
import { withColorMode } from '../../../utils/rangka-color-mode'
import { withPreviewHeight } from '../../../utils/rangka-preview-height'
import { withRangkaRuntime } from '../../../utils/rangka-runtime'
import { withDocumentTheme, readerTheme } from '../../../utils/rangka-theme'
import { readRangkaBytes } from '../../../utils/rangka-storage'

const imageTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

function resolveImageType(metadata: Record<string, any>) {
  const declared = String(metadata.mimeType || '')
  if (declared.startsWith('image/')) return declared
  const extension = String(metadata.filename || '').toLowerCase().split('.').pop() || ''
  return imageTypes[extension] || 'application/octet-stream'
}

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  // Preview is intentionally owner-only. Public and unlisted delivery stays on
  // the dedicated /api/share routes so this endpoint cannot widen exposure.
  const rangka = await db.select().from(rangkaItems)
    .where(and(eq(rangkaItems.id, id), eq(rangkaItems.userId, user.id))).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })
  if (!['image', 'pdf', 'html'].includes(rangka.type)) {
    throw createError({ statusCode: 400, message: 'Only image, PDF, and HTML rangka can be previewed inline' })
  }

  const content = await readRangkaBytes(rangka.contentPath)
  const metadata = rangka.metadata || {}
  const filename = String(metadata.filename || rangka.slug).replace(/[^a-zA-Z0-9._-]/g, '_')

  if (rangka.type === 'pdf') {
    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
  } else if (rangka.type === 'html') {
    // Owner-only preview of untrusted HTML: same sandbox boundary as public
    // delivery, so the frame cannot reach the app origin, forms, or the network.
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    setHeader(event, 'Content-Security-Policy', "sandbox allow-scripts; default-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https: data:; connect-src 'none'; frame-ancestors 'self'; form-action 'none'")
    setHeader(event, 'Vary', 'Sec-CH-Prefers-Color-Scheme')
    return withRangkaRuntime(withDocumentTheme(withColorMode(withPreviewHeight(content.toString())), readerTheme(event)))
  } else {
    setHeader(event, 'Content-Type', resolveImageType(metadata))
    setHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'")
  }
  setHeader(event, 'Content-Disposition', `inline; filename="${filename}"`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'private, max-age=0, must-revalidate')
  return content
})
