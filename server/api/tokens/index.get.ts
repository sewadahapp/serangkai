import { db, apiTokens } from '../../db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const tokens = await db.select({
    id: apiTokens.id,
    name: apiTokens.name,
    scopes: apiTokens.scopes,
    lastUsedAt: apiTokens.lastUsedAt,
    expiresAt: apiTokens.expiresAt,
    createdAt: apiTokens.createdAt,
  }).from(apiTokens).where(eq(apiTokens.userId, user.id))
  
  return { tokens }
})
