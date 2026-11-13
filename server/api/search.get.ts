import { rangkaItems, folders } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { requireUser } from '../utils/require-auth'
import { rangkaShareUrlForCaller } from '../utils/share'
import { and, eq, inArray, like, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireUser(event)
  const query = String(getQuery(event).q || '').trim()
  const folderId = String(getQuery(event).folderId || '') || null
  if (!query) return { rangka: [], folders: [] }

  const pattern = `%${query}%`
  let scope: Set<string> | null = null
  let scopedFolders: Array<typeof folders.$inferSelect> = []
  if (folderId) {
    const userFolders = await db.select().from(folders).where(eq(folders.userId, user.id))
    if (!userFolders.some(folder => folder.id === folderId)) {
      throw createError({ statusCode: 404, message: 'Folder not found' })
    }
    scope = new Set([folderId])
    let changed = true
    while (changed) {
      changed = false
      for (const folder of userFolders) {
        if (folder.parentId && scope.has(folder.parentId) && !scope.has(folder.id)) {
          scope.add(folder.id)
          changed = true
        }
      }
    }
    // Keep the whole subtree so the sidebar and selected folder stay intact
    // while rangka are filtered by the query.
    scopedFolders = userFolders.filter(folder => scope!.has(folder.id))
  }

  const ids = scope ? [...scope] : null
  const [foundRangka, foundFolders] = await Promise.all([
    db.select().from(rangkaItems).where(and(
      eq(rangkaItems.userId, user.id),
      ...(ids ? [inArray(rangkaItems.folderId, ids)] : []),
      or(like(rangkaItems.title, pattern), like(rangkaItems.slug, pattern)),
    )),
    ids
      ? Promise.resolve(scopedFolders)
      : db.select().from(folders).where(and(eq(folders.userId, user.id), like(folders.name, pattern))),
  ])
  return {
    rangka: foundRangka.map(rangka => ({
      ...rangka,
      shareUrl: rangkaShareUrlForCaller(event, rangka),
    })),
    folders: foundFolders,
  }
})
