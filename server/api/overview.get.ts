import { rangkaItems, folders } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { requireScope } from '../utils/require-auth'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'read')

  const [userRangka, userFolders] = await Promise.all([
    db.select().from(rangkaItems).where(eq(rangkaItems.userId, user.id)),
    db.select({ id: folders.id }).from(folders).where(eq(folders.userId, user.id)),
  ])

  const byType: Record<string, number> = {}
  const byVisibility: Record<string, number> = {}
  let totalBytes = 0
  for (const rangka of userRangka) {
    byType[rangka.type] = (byType[rangka.type] || 0) + 1
    byVisibility[rangka.visibility] = (byVisibility[rangka.visibility] || 0) + 1
    const size = Number((rangka.metadata as any)?.size)
    if (Number.isFinite(size) && size > 0) totalBytes += size
  }

  const recent = [...userRangka]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)
    .map(({ contentPath: _contentPath, userId: _userId, ...rangka }) => rangka)

  return {
    summary: {
      rangka: userRangka.length,
      folders: userFolders.length,
      publicRangka: byVisibility.public || 0,
      unlistedRangka: byVisibility.unlisted || 0,
      privateRangka: byVisibility.private || 0,
      totalBytes,
      byType,
    },
    recent,
  }
})
