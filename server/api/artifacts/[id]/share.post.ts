import { and, eq } from 'drizzle-orm'
import { artifacts } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireScope } from '../../../utils/require-auth'
import { artifactShareUrl } from '../../../utils/share'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  // Generating a capability URL is a write operation: a read-only agent must
  // not be able to create a public/unlisted entry point.
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  const artifact = await db.select().from(artifacts).where(and(eq(artifacts.id, id || ''), eq(artifacts.userId, user.id))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })
  // Every type opens in the reader so shared links get the same chrome.
  const url = artifactShareUrl(event, artifact)
  if (!url) throw createError({ statusCode: 400, message: 'Private artifacts do not have a share link' })
  return { slug: artifact.slug, visibility: artifact.visibility, url }
})
