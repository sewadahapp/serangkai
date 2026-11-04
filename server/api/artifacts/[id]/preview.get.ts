import { and, eq } from 'drizzle-orm'
import { artifacts } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { getRequestStorage } from '#serangkai-storage-runtime'
import { requireUser } from '../../../utils/require-auth'

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
  const storage = getRequestStorage(event)
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  // Preview is intentionally owner-only. Public and unlisted delivery stays on
  // the dedicated /api/share routes so this endpoint cannot widen exposure.
  const artifact = await db.select().from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.userId, user.id))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })
  if (artifact.type !== 'image' && artifact.type !== 'pdf') {
    throw createError({ statusCode: 400, message: 'Only image and PDF artifacts can be previewed inline' })
  }

  const content = await storage.read(artifact.contentPath)
  const metadata = artifact.metadata || {}
  const filename = String(metadata.filename || artifact.slug).replace(/[^a-zA-Z0-9._-]/g, '_')

  if (artifact.type === 'pdf') {
    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
  } else {
    setHeader(event, 'Content-Type', resolveImageType(metadata))
    setHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'")
  }
  setHeader(event, 'Content-Disposition', `inline; filename="${filename}"`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'private, max-age=0, must-revalidate')
  return content
})
