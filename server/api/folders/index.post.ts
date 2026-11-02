import { nanoid } from 'nanoid'
import { folders } from '../../db'
import { getRequestDatabase } from '../../db/adapter'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const schema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const body = await readBody(event)
  const result = schema.safeParse(body)
  
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }
  
  const { name, parentId } = result.data
  
  let path = `/${name}`
  if (parentId) {
    const parent = await db.select().from(folders).where(eq(folders.id, parentId)).get()
    if (parent && parent.userId === user.id) {
      path = `${parent.path}/${name}`
    }
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
  
  return { folder: { id: folderId, name, parentId, path } }
})
