import { and, count, desc, eq, inArray, like, or } from 'drizzle-orm'
import { rangkaItems, folders } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { requireUser } from '../utils/require-auth'
import { rangkaShareUrlForCaller } from '../utils/share'

// This endpoint is tailored to the workspace UI. Existing list and search API
// contracts remain unchanged for integrations that consume the full result.
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const db = await getRequestDatabase(event)
  const params = getQuery(event)
  const query = String(params.q || '').trim()
  const folderId = String(params.folderId || '')
  const requestedPage = Number(params.page || 1)
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 1000000) {
    throw createError({ statusCode: 400, message: 'Invalid page' })
  }
  const pageSize = 25
  const userFolders = await db.select().from(folders).where(eq(folders.userId, user.id))
  let ids: string[] | undefined
  if (folderId) {
    if (!userFolders.some(folder => folder.id === folderId)) throw createError({ statusCode: 404, message: 'Folder not found' })
    const scope = new Set([folderId])
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
    ids = [...scope]
  }
  const where = and(
    eq(rangkaItems.userId, user.id),
    ...(ids ? [inArray(rangkaItems.folderId, ids)] : []),
    ...(query ? [or(like(rangkaItems.title, `%${query}%`), like(rangkaItems.slug, `%${query}%`))] : []),
  )
  const [totalRows, counts] = await Promise.all([
    db.select({ value: count() }).from(rangkaItems).where(where),
    db.select({ folderId: rangkaItems.folderId, value: count() }).from(rangkaItems).where(eq(rangkaItems.userId, user.id)).groupBy(rangkaItems.folderId),
  ])
  const total = totalRows[0]?.value || 0
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)))
  const rows = await db.select().from(rangkaItems).where(where)
    .orderBy(desc(rangkaItems.updatedAt), desc(rangkaItems.id)).limit(pageSize).offset((page - 1) * pageSize)
  return {
    folders: userFolders,
    rangka: rows.map(rangka => ({ ...rangka, shareUrl: rangkaShareUrlForCaller(event, rangka) })),
    counts,
    total,
    page,
    pageSize,
  }
})
