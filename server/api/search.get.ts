import { artifacts, folders } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { requireUser } from '../utils/require-auth'
import { artifactShareUrl } from '../utils/share'
import { and, eq, inArray, like, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireUser(event)
  const query = String(getQuery(event).q || '').trim()
  const folderId = String(getQuery(event).folderId || '') || null
  if (!query) return { artifacts: [], folders: [] }

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
    // while artifacts are filtered by the query.
    scopedFolders = userFolders.filter(folder => scope!.has(folder.id))
  }

  const ids = scope ? [...scope] : null
  const [foundArtifacts, foundFolders] = await Promise.all([
    db.select().from(artifacts).where(and(
      eq(artifacts.userId, user.id),
      ...(ids ? [inArray(artifacts.folderId, ids)] : []),
      or(like(artifacts.title, pattern), like(artifacts.slug, pattern)),
    )),
    ids
      ? Promise.resolve(scopedFolders)
      : db.select().from(folders).where(and(eq(folders.userId, user.id), like(folders.name, pattern))),
  ])
  return {
    artifacts: foundArtifacts.map(artifact => ({
      ...artifact,
      shareUrl: artifactShareUrl(event, artifact),
    })),
    folders: foundFolders,
  }
})
