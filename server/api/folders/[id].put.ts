import { folders } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireScope } from '../../utils/require-auth'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  name: z.string().trim().min(1).max(120).refine(name => !name.includes('/'), 'Folder names cannot contain slashes'),
})

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Folder ID required' })

  const folder = await db.select().from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id))).get()
  if (!folder) throw createError({ statusCode: 404, message: 'Folder not found' })

  const input = schema.safeParse(await readBody(event))
  if (!input.success) throw createError({ statusCode: 400, message: 'Invalid input' })

  const { name } = input.data
  let parentPath = ''
  if (folder.parentId) {
    const parent = await db.select().from(folders)
      .where(and(eq(folders.id, folder.parentId), eq(folders.userId, user.id))).get()
    if (!parent) throw createError({ statusCode: 409, message: 'Parent folder no longer exists' })
    parentPath = parent.path
  }

  const previousPath = folder.path
  const nextPath = `${parentPath}/${name}`
  const now = new Date()

  await db.update(folders).set({ name, path: nextPath, updatedAt: now })
    .where(and(eq(folders.id, folder.id), eq(folders.userId, user.id)))

  // Rewrite descendant paths locally so names containing LIKE wildcards cannot
  // corrupt the prefix match.
  const descendants = await db.select().from(folders).where(eq(folders.userId, user.id))
  for (const descendant of descendants) {
    if (descendant.id === folder.id || !descendant.path.startsWith(`${previousPath}/`)) continue
    await db.update(folders).set({ path: `${nextPath}${descendant.path.slice(previousPath.length)}`, updatedAt: now })
      .where(eq(folders.id, descendant.id))
  }

  return { folder: { ...folder, name, path: nextPath, updatedAt: now } }
})
