import { db, artifactVersions, artifacts } from '../../../db'
import { requireUser } from '../../../utils/require-auth'
import { and, desc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  const artifact = await db.select().from(artifacts)
    .where(and(eq(artifacts.id, id || ''), eq(artifacts.userId, user.id))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })
  const versions = await db.select({
    id: artifactVersions.id, version: artifactVersions.version,
    metadata: artifactVersions.metadata, createdAt: artifactVersions.createdAt,
  }).from(artifactVersions).where(eq(artifactVersions.artifactId, artifact.id))
    .orderBy(desc(artifactVersions.version))
  return { versions }
})
