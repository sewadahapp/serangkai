import { artifacts, folders } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { requireScope } from '../utils/require-auth'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'read')

  const [userArtifacts, userFolders] = await Promise.all([
    db.select().from(artifacts).where(eq(artifacts.userId, user.id)),
    db.select({ id: folders.id }).from(folders).where(eq(folders.userId, user.id)),
  ])

  const byType: Record<string, number> = {}
  const byVisibility: Record<string, number> = {}
  let totalBytes = 0
  for (const artifact of userArtifacts) {
    byType[artifact.type] = (byType[artifact.type] || 0) + 1
    byVisibility[artifact.visibility] = (byVisibility[artifact.visibility] || 0) + 1
    const size = Number((artifact.metadata as any)?.size)
    if (Number.isFinite(size) && size > 0) totalBytes += size
  }

  const recent = [...userArtifacts]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)
    .map(({ contentPath: _contentPath, userId: _userId, ...artifact }) => artifact)

  return {
    summary: {
      artifacts: userArtifacts.length,
      folders: userFolders.length,
      publicArtifacts: byVisibility.public || 0,
      unlistedArtifacts: byVisibility.unlisted || 0,
      privateArtifacts: byVisibility.private || 0,
      totalBytes,
      byType,
    },
    recent,
  }
})
