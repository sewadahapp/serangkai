import { folders } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireScope } from '../../utils/require-auth'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const schema = z.object({
  name: z.string().trim().min(1).max(120).refine(name => !name.includes('/'), 'Folder names cannot contain slashes').optional(),
  parentId: z.string().min(1).nullable().optional(),
}).refine(input => input.name !== undefined || input.parentId !== undefined, 'Nothing to update')

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

  const allFolders = await db.select().from(folders).where(eq(folders.userId, user.id))
  const byId = new Map(allFolders.map(item => [item.id, item]))
  const name = input.data.name ?? folder.name
  const parentId = input.data.parentId === undefined ? folder.parentId : input.data.parentId

  if (parentId === folder.id) {
    throw createError({ statusCode: 400, message: 'A folder cannot be its own parent' })
  }

  let parentPath = ''
  if (parentId) {
    const parent = byId.get(parentId)
    if (!parent) throw createError({ statusCode: 400, message: 'Parent folder not found' })
    // Walk up from the new parent; if we reach this folder, the move would
    // create a cycle and detach the subtree from the root.
    let cursor: typeof folder | undefined = parent
    const visited = new Set<string>()
    while (cursor) {
      if (cursor.id === folder.id) throw createError({ statusCode: 400, message: 'Cannot move a folder into itself or its descendants' })
      if (visited.has(cursor.id)) break
      visited.add(cursor.id)
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
    }
    parentPath = parent.path
  }

  const previousPath = folder.path
  const nextPath = `${parentPath}/${name}`
  const now = new Date()

  await db.update(folders).set({ name, parentId: parentId || null, path: nextPath, updatedAt: now })
    .where(and(eq(folders.id, folder.id), eq(folders.userId, user.id)))

  // Rewrite descendant paths locally so names containing LIKE wildcards cannot
  // corrupt the prefix match.
  for (const descendant of allFolders) {
    if (descendant.id === folder.id || !descendant.path.startsWith(`${previousPath}/`)) continue
    await db.update(folders).set({ path: `${nextPath}${descendant.path.slice(previousPath.length)}`, updatedAt: now })
      .where(and(eq(folders.id, descendant.id), eq(folders.userId, user.id)))
  }

  return { folder: { ...folder, name, parentId: parentId || null, path: nextPath, updatedAt: now } }
})
