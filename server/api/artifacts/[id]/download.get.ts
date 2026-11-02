import { and, eq } from 'drizzle-orm'
import { db, artifacts } from '../../../db'
import { storage } from '../../../storage'
import { requireUser } from '../../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  const artifact = await db.select().from(artifacts).where(eq(artifacts.id, id || '')).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })
  if (artifact.visibility === 'private') requireUser(event)
  if (artifact.visibility === 'private' && artifact.userId !== user?.id) throw createError({ statusCode: 403, message: 'Forbidden' })
  const content = await storage.read(artifact.contentPath)
  const metadata = artifact.metadata || {}
  setHeader(event, 'Content-Type', metadata.mimeType || 'application/octet-stream')
  setHeader(event, 'Content-Disposition', `attachment; filename="${String(metadata.filename || artifact.slug).replace(/[^a-zA-Z0-9._-]/g, '_')}"`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return content
})
