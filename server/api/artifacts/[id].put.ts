import { artifacts, artifactVersions, folders } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireScope } from '../../utils/require-auth'
import { z } from 'zod'
import { and, eq, max } from 'drizzle-orm'
import { readArtifactBytes } from '../../utils/artifact-storage'
import { appendVersion } from '../../utils/artifact-versions'
import { checkTextArtifact } from '../../utils/artifacts'

const schema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  visibility: z.enum(['private', 'public', 'unlisted']).optional(),
  folderId: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
  baseVersion: z.number().int().nonnegative().optional(),
})

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const artifact = await db.select().from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.userId, user.id))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })

  const input = schema.safeParse(await readBody(event))
  if (!input.success) throw createError({ statusCode: 400, message: 'Invalid input' })
  const changes = input.data
  const now = new Date()
  let contentPath = artifact.contentPath
  let version: number | undefined

  const latestRow = await db.select({ latest: max(artifactVersions.version) })
    .from(artifactVersions).where(eq(artifactVersions.artifactId, artifact.id)).get()
  const currentVersion = Number(latestRow?.latest || 0)

  if (changes.content !== undefined) {
    // Every content write must declare which version it was based on, so two
    // concurrent writers cannot silently overwrite each other.
    if (changes.baseVersion === undefined) {
      throw createError({
        statusCode: 400,
        message: `baseVersion is required when updating content. The current version is ${currentVersion}.`,
        data: { currentVersion },
      })
    }
    if (changes.baseVersion !== currentVersion) {
      throw createError({
        statusCode: 409,
        message: `Stale write refused: baseVersion ${changes.baseVersion} but the current version is ${currentVersion}. Re-read the artifact, merge your changes, then save again with baseVersion ${currentVersion}.`,
        data: { currentVersion },
      })
    }

    const checked = checkTextArtifact(artifact.type, changes.content, artifact.slug)
    if (!checked.ok) throw createError({ statusCode: 400, message: checked.message })
    if (Object.keys(checked.metadata).length) {
      changes.metadata = { ...(changes.metadata || artifact.metadata || {}), ...checked.metadata }
    }

    // Only record a version when the bytes actually change; a no-op save
    // must not append duplicate history.
    const currentContent = (await readArtifactBytes(artifact.contentPath)).toString()
    if (currentContent !== changes.content) {
      version = currentVersion + 1
      contentPath = `${user.id}/${artifact.id}/versions/${version}`
      const claimed = await appendVersion(db, {
        artifactId: artifact.id, version, contentPath,
        metadata: changes.metadata || artifact.metadata || {}, content: changes.content,
      })
      if (!claimed) {
        // A concurrent writer with the same baseVersion won the number.
        throw createError({
          statusCode: 409,
          message: `Stale write refused: version ${version} was published by another writer. Re-read the artifact, merge your changes, then save again with baseVersion ${version}.`,
          data: { currentVersion: version },
        })
      }
    }
  }

  if (changes.folderId) {
    const folder = await db.select().from(folders)
      .where(and(eq(folders.id, changes.folderId), eq(folders.userId, user.id))).get()
    if (!folder) {
      throw createError({ statusCode: 400, message: 'Folder not found' })
    }
  }

  await db.update(artifacts).set({
    ...(changes.title === undefined ? {} : { title: changes.title }),
    ...(changes.visibility === undefined ? {} : { visibility: changes.visibility }),
    ...(changes.folderId === undefined ? {} : { folderId: changes.folderId }),
    ...(changes.metadata === undefined ? {} : { metadata: changes.metadata }),
    ...(changes.content === undefined ? {} : { contentPath }),
    updatedAt: now,
  }).where(and(eq(artifacts.id, artifact.id), eq(artifacts.userId, user.id)))

  return { artifact: { ...artifact, ...changes, contentPath, updatedAt: now }, version, versionCreated: version !== undefined }
})
