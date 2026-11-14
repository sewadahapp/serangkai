import { rangkaItems, rangkaVersions } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { deleteBundle } from '../../utils/bundles'
import { requireScope } from '../../utils/require-auth'
import { and, eq } from 'drizzle-orm'
import { removeRangka } from '../../utils/rangka-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })

  const rangka = await db.select().from(rangkaItems)
    .where(and(eq(rangkaItems.id, id), eq(rangkaItems.userId, user.id))).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })

  const versions = await db.select({ contentPath: rangkaVersions.contentPath })
    .from(rangkaVersions).where(eq(rangkaVersions.rangkaId, rangka.id))
  const contentPaths = new Set([rangka.contentPath, ...versions.map(version => version.contentPath)])

  await db.delete(rangkaItems).where(and(eq(rangkaItems.id, rangka.id), eq(rangkaItems.userId, user.id)))

  // Best-effort cleanup after the row is gone: a failed file delete must not
  // keep a deleted rangka visible or leave the database pointing at it.
  for (const contentPath of contentPaths) {
    try { await removeRangka(contentPath) } catch {}
  }
  if (rangka.type === 'bundle') {
    try { await deleteBundle(`${user.id}/${rangka.id}/bundle`) } catch {}
  }

  return { message: 'Rangka deleted' }
})
