import { db, folders } from '../../db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const userFolders = await db.select().from(folders).where(eq(folders.userId, user.id))
  return { folders: userFolders }
})
