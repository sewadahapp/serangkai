import { nanoid } from 'nanoid'
import { rangkaVersions, rangkaItems } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireScope } from '../../../utils/require-auth'
import { makeSlug } from '../../../utils/rangka'
import { isSlugConflict } from '../../../db/migrations'
import { and, eq } from 'drizzle-orm'
import { readRangkaBytes, writeRangka } from '../../../utils/rangka-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const source = await db.select().from(rangkaItems)
    .where(and(eq(rangkaItems.id, id), eq(rangkaItems.userId, user.id))).get()
  if (!source) throw createError({ statusCode: 404, message: 'Rangka not found' })

  const body = await readBody(event).catch(() => ({}))
  const requestedTitle = typeof body?.title === 'string' ? body.title.trim() : ''
  const title = requestedTitle || `${source.title} (copy)`

  const duplicateId = nanoid()
  const contentPath = `${user.id}/${duplicateId}/content`
  await writeRangka(contentPath, await readRangkaBytes(source.contentPath))

  const now = new Date()
  let slug = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    slug = makeSlug(title)
    try {
      await db.insert(rangkaItems).values({
        id: duplicateId,
        userId: user.id,
        folderId: source.folderId,
        slug,
        title,
        type: source.type,
        // Copies start private even when the source was shared, so duplicating a
        // public rangka never widens exposure by accident.
        visibility: 'private',
        contentPath,
        metadata: { ...(source.metadata || {}), duplicatedFrom: source.id },
        createdAt: now,
        updatedAt: now,
      })
      break
    } catch (error) {
      if (!isSlugConflict(error) || attempt === 2) throw error
    }
  }
  await db.insert(rangkaVersions).values({
    id: nanoid(), rangkaId: duplicateId, version: 1, contentPath,
    metadata: source.metadata || {}, createdAt: now,
  })

  return { rangka: { id: duplicateId, slug, title, type: source.type, visibility: 'private', folderId: source.folderId } }
})
