import { and, count, desc, eq, inArray, like, or } from 'drizzle-orm'
import { artifacts, folders } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { requireUser } from '../utils/require-auth'
import { artifactShareUrlForCaller } from '../utils/share'

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
    eq(artifacts.userId, user.id),
    ...(ids ? [inArray(artifacts.folderId, ids)] : []),
    ...(query ? [or(like(artifacts.title, `%${query}%`), like(artifacts.slug, `%${query}%`))] : []),
  )
  const [totalRows, counts] = await Promise.all([
    db.select({ value: count() }).from(artifacts).where(where),
    db.select({ folderId: artifacts.folderId, value: count() }).from(artifacts).where(eq(artifacts.userId, user.id)).groupBy(artifacts.folderId),
  ])
  const total = totalRows[0]?.value || 0
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)))
  const rows = await db.select().from(artifacts).where(where)
    .orderBy(desc(artifacts.updatedAt), desc(artifacts.id)).limit(pageSize).offset((page - 1) * pageSize)
  return {
    folders: userFolders,
    artifacts: rows.map(artifact => ({ ...artifact, shareUrl: artifactShareUrlForCaller(event, artifact) })),
    counts,
    total,
    page,
    pageSize,
  }
})
