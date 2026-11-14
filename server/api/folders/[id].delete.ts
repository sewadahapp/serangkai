import { rangkaItems, folders } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireScope } from '../../utils/require-auth'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Folder ID required' })

  const folder = await db.select().from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id))).get()
  if (!folder) throw createError({ statusCode: 404, message: 'Folder not found' })

  // Deleting a non-empty folder would either cascade-delete subfolders or
  // silently orpha rangka, so require the caller to empty it first.
  const child = await db.select({ id: folders.id }).from(folders)
    .where(and(eq(folders.userId, user.id), eq(folders.parentId, folder.id))).get()
  const rangka = await db.select({ id: rangkaItems.id }).from(rangkaItems)
    .where(and(eq(rangkaItems.userId, user.id), eq(rangkaItems.folderId, folder.id))).get()
  if (child || rangka) {
    throw createError({ statusCode: 409, message: 'Folder is not empty. Move or remove its contents first.' })
  }

  await db.delete(folders).where(and(eq(folders.id, folder.id), eq(folders.userId, user.id)))
  return { message: 'Folder deleted' }
})
