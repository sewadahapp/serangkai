import { nanoid } from 'nanoid'
import { artifacts, artifactVersions } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { storage } from '#serangkai-storage-runtime'
import { requireScope } from '../../utils/require-auth'
import { z } from 'zod'
import { and, eq, max } from 'drizzle-orm'

const schema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  visibility: z.enum(['private', 'public', 'unlisted']).optional(),
  folderId: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
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

  if (changes.content !== undefined) {
    const current = await db.select({ latest: max(artifactVersions.version) })
      .from(artifactVersions).where(eq(artifactVersions.artifactId, artifact.id)).get()
    version = Number(current?.latest || 0) + 1
    contentPath = `${user.id}/${artifact.id}/versions/${version}`
    await storage.save(contentPath, changes.content)
    await db.insert(artifactVersions).values({
      id: nanoid(), artifactId: artifact.id, version, contentPath,
      metadata: changes.metadata || artifact.metadata || {}, createdAt: now,
    })
  }

  await db.update(artifacts).set({
    ...(changes.title === undefined ? {} : { title: changes.title }),
    ...(changes.visibility === undefined ? {} : { visibility: changes.visibility }),
    ...(changes.folderId === undefined ? {} : { folderId: changes.folderId }),
    ...(changes.metadata === undefined ? {} : { metadata: changes.metadata }),
    ...(changes.content === undefined ? {} : { contentPath }),
    updatedAt: now,
  }).where(and(eq(artifacts.id, artifact.id), eq(artifacts.userId, user.id)))

  return { artifact: { ...artifact, ...changes, contentPath, updatedAt: now }, version }
})
