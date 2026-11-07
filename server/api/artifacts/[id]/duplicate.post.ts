import { nanoid } from 'nanoid'
import { artifactVersions, artifacts } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireScope } from '../../../utils/require-auth'
import { makeSlug } from '../../../utils/artifacts'
import { and, eq } from 'drizzle-orm'
import { readArtifactBytes, writeArtifact } from '../../../utils/artifact-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const source = await db.select().from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.userId, user.id))).get()
  if (!source) throw createError({ statusCode: 404, message: 'Artifact not found' })

  const body = await readBody(event).catch(() => ({}))
  const requestedTitle = typeof body?.title === 'string' ? body.title.trim() : ''
  const title = requestedTitle || `${source.title} (copy)`

  const duplicateId = nanoid()
  const contentPath = `${user.id}/${duplicateId}/content`
  await writeArtifact(contentPath, await readArtifactBytes(source.contentPath))

  const now = new Date()
  const slug = makeSlug(title)
  await db.insert(artifacts).values({
    id: duplicateId,
    userId: user.id,
    folderId: source.folderId,
    slug,
    title,
    type: source.type,
    // Copies start private even when the source was shared, so duplicating a
    // public artifact never widens exposure by accident.
    visibility: 'private',
    contentPath,
    metadata: { ...(source.metadata || {}), duplicatedFrom: source.id },
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(artifactVersions).values({
    id: nanoid(), artifactId: duplicateId, version: 1, contentPath,
    metadata: source.metadata || {}, createdAt: now,
  })

  return { artifact: { id: duplicateId, slug, title, type: source.type, visibility: 'private', folderId: source.folderId } }
})
