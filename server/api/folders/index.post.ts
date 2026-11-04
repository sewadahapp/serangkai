import { nanoid } from 'nanoid'
import { folders } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireScope } from '../../utils/require-auth'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

const schema = z.object({
  name: z.string().trim().min(1).max(120).refine(name => !name.includes('/'), 'Folder names cannot contain slashes'),
  parentId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')

  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }

  const { name, parentId } = result.data

  let path = `/${name}`
  if (parentId) {
    const parent = await db.select().from(folders)
      .where(and(eq(folders.id, parentId), eq(folders.userId, user.id))).get()
    if (!parent) {
      throw createError({ statusCode: 400, message: 'Parent folder not found' })
    }
    path = `${parent.path}/${name}`
  }

  const folderId = nanoid()
  await db.insert(folders).values({
    id: folderId,
    userId: user.id,
    parentId: parentId || null,
    name,
    path,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return { folder: { id: folderId, name, parentId: parentId || null, path } }
})
