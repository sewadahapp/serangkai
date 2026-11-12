import { artifactVersions, artifacts } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireUser } from '../../../utils/require-auth'
import { and, count, desc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  const artifact = await db.select().from(artifacts)
    .where(and(eq(artifacts.id, id || ''), eq(artifacts.userId, user.id))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })
  const fields = { id: artifactVersions.id, version: artifactVersions.version, metadata: artifactVersions.metadata, createdAt: artifactVersions.createdAt }
  const query = getQuery(event)
  // Preserve the existing unpaginated response for API consumers.
  if (query.page === undefined) {
    const versions = await db.select(fields).from(artifactVersions)
      .where(eq(artifactVersions.artifactId, artifact.id)).orderBy(desc(artifactVersions.version))
    return { versions }
  }
  const requestedPage = Number(query.page)
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 1000000) {
    throw createError({ statusCode: 400, message: 'Invalid page' })
  }
  const pageSize = 8
  const [counts, latest] = await Promise.all([
    db.select({ value: count() }).from(artifactVersions).where(eq(artifactVersions.artifactId, artifact.id)),
    db.select({ version: artifactVersions.version }).from(artifactVersions).where(eq(artifactVersions.artifactId, artifact.id)).orderBy(desc(artifactVersions.version)).limit(1),
  ])
  const total = counts[0]?.value || 0
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)))
  const versions = await db.select(fields).from(artifactVersions).where(eq(artifactVersions.artifactId, artifact.id))
    .orderBy(desc(artifactVersions.version)).limit(pageSize).offset((page - 1) * pageSize)
  return { versions, total, page, pageSize, latestVersion: latest[0]?.version ?? null }
})
