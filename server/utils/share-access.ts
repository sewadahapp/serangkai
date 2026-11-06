import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { artifacts } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { isValidShareKey } from './share'

/**
 * Single authorization path for shared artifacts.
 *
 * Raw delivery, the rendered reader page, and bundle assets all use this, so
 * visibility rules cannot drift apart and a new delivery surface cannot
 * accidentally skip the private/unlisted check.
 */
export async function loadSharedArtifact(event: H3Event, slug: string) {
  const db = await getRequestDatabase(event)
  const artifact = await db.select().from(artifacts).where(eq(artifacts.slug, slug)).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })

  const key = String(getQuery(event).k || '')
  if (artifact.visibility === 'private') {
    const user = event.context.user
    if (!user || user.id !== artifact.userId) throw createError({ statusCode: 403, message: 'Forbidden' })
  } else if (artifact.visibility === 'unlisted' && !isValidShareKey(artifact.id, key)) {
    throw createError({ statusCode: 404, message: 'Artifact not found' })
  }

  return artifact
}
