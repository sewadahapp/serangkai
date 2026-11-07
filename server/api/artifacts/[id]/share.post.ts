import { and, eq } from 'drizzle-orm'
import { artifacts } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireUser } from '../../../utils/require-auth'
import { signShareKey } from '../../../utils/share'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  const artifact = await db.select().from(artifacts).where(and(eq(artifacts.id, id || ''), eq(artifacts.userId, user.id))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })
  const key = signShareKey(artifact.id)
  const baseUrl = process.env.PUBLIC_BASE_URL || getRequestURL(event).origin
  // Every type opens in the reader so shared links get the same chrome.
  return { slug: artifact.slug, visibility: artifact.visibility, url: `${baseUrl}/share/${artifact.slug}${artifact.visibility === 'unlisted' ? `?k=${key}` : ''}` }
})
