import { artifacts, artifactVersions } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { deleteBundle } from '../../utils/bundles'
import { requireScope } from '../../utils/require-auth'
import { and, eq } from 'drizzle-orm'
import { removeArtifact } from '../../utils/artifact-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const artifact = await db.select().from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.userId, user.id))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })

  const versions = await db.select({ contentPath: artifactVersions.contentPath })
    .from(artifactVersions).where(eq(artifactVersions.artifactId, artifact.id))
  const contentPaths = new Set([artifact.contentPath, ...versions.map(version => version.contentPath)])

  await db.delete(artifacts).where(and(eq(artifacts.id, artifact.id), eq(artifacts.userId, user.id)))

  // Best-effort cleanup after the row is gone: a failed file delete must not
  // keep a deleted artifact visible or leave the database pointing at it.
  for (const contentPath of contentPaths) {
    try { await removeArtifact(contentPath) } catch {}
  }
  if (artifact.type === 'bundle') {
    try { await deleteBundle(`${user.id}/${artifact.id}/bundle`) } catch {}
  }

  return { message: 'Artifact deleted' }
})
