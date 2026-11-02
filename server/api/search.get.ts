import { db, artifacts, folders } from '../db'
import { requireUser } from '../utils/require-auth'
import { and, eq, like, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const query = String(getQuery(event).q || '').trim()
  if (!query) return { artifacts: [], folders: [] }
  const pattern = `%${query}%`
  const [foundArtifacts, foundFolders] = await Promise.all([
    db.select().from(artifacts).where(and(eq(artifacts.userId, user.id), or(like(artifacts.title, pattern), like(artifacts.slug, pattern)))),
    db.select().from(folders).where(and(eq(folders.userId, user.id), like(folders.name, pattern))),
  ])
  return { artifacts: foundArtifacts, folders: foundFolders }
})
