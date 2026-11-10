import { eq } from 'drizzle-orm'
import { artifacts } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireUser } from '../../../utils/require-auth'
import { isValidShareKey } from '../../../utils/share'
import { readArtifactBytes } from '../../../utils/artifact-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  const artifact = await db.select().from(artifacts).where(eq(artifacts.id, id || '')).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })

  if (artifact.visibility === 'private') {
    requireUser(event)
    if (artifact.userId !== user?.id) throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  if (artifact.visibility === 'unlisted' && artifact.userId !== user?.id) {
    // An unlisted artifact is only reachable through its signed capability
    // link. Knowing the opaque id is not authorization.
    const key = String(getQuery(event).k || '')
    if (!isValidShareKey(artifact.id, key)) {
      throw createError({ statusCode: 404, message: 'Artifact not found' })
    }
  }

  setHeader(event, 'Cache-Control', artifact.visibility === 'public' ? 'public, max-age=60' : 'private, no-store')
  const content = await readArtifactBytes(artifact.contentPath)
  const metadata = artifact.metadata || {}
  setHeader(event, 'Content-Type', metadata.mimeType || 'application/octet-stream')
  setHeader(event, 'Content-Disposition', `attachment; filename="${String(metadata.filename || artifact.slug).replace(/[^a-zA-Z0-9._-]/g, '_')}"`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return content
})
