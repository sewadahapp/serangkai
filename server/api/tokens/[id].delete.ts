import { apiTokens, oauthTokens } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireScope } from '../../utils/require-auth'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'full')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Token ID required' })
  }

  // An OAuth access token belongs to a connected client. Revoking it here would
  // silently disconnect that client, so it is only revocable as a whole grant
  // from `/api/oauth/clients`.
  const grant = await db.select({ id: oauthTokens.id }).from(oauthTokens).where(eq(oauthTokens.apiTokenId, id)).get()
  if (grant) {
    throw createError({ statusCode: 404, message: 'Token not found' })
  }

  await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)))

  return { message: 'Token revoked' }
})
