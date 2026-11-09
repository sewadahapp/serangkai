import { and, eq } from 'drizzle-orm'
import { oauthTokens } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireSessionUser } from '../../../utils/require-auth'
import { revokeGrant } from '../../../utils/oauth'

/**
 * Disconnect one OAuth client.
 *
 * Removing the grant deletes its access token as well, so the agent loses
 * access immediately rather than when its current token happens to expire.
 */
export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireSessionUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Grant ID required' })

  const grant = await db.select().from(oauthTokens)
    .where(and(eq(oauthTokens.id, id), eq(oauthTokens.userId, user.id))).get()
  // A foreign or unknown grant is reported as missing, not forbidden: the id
  // is not a secret, but it should not confirm what exists.
  if (!grant) throw createError({ statusCode: 404, message: 'Connected client not found' })

  await revokeGrant(db, grant.id)
  return { message: 'Client disconnected' }
})
