import { apiTokens } from '../../db'
import { getRequestDatabase } from '../../db/adapter'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Token ID required' })
  }
  
  await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)))
  
  return { message: 'Token revoked' }
})
