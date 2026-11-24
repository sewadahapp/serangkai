import { and, eq } from 'drizzle-orm'
import { oauthTokens } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireSessionUser } from '../../../utils/require-auth'
import { normalizeConnectionLabel, setConnectionLabel } from '../../../utils/oauth'
import { readBoundedBody } from '../../../utils/request-body'

/**
 * Rename one connected agent. An empty name clears it, so the list falls back
 * to the name the client registered with. The owner's name always wins over
 * one an agent gave itself.
 */
export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireSessionUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Grant ID required' })

  const body = await readBoundedBody(event, { maxBytes: 4 * 1024, parse: 'json' })
  if (typeof body?.name !== 'string') throw createError({ statusCode: 400, message: 'A name is required.' })

  const grant = await db.select({ id: oauthTokens.id }).from(oauthTokens)
    .where(and(eq(oauthTokens.id, id), eq(oauthTokens.userId, user.id))).get()
  if (!grant) throw createError({ statusCode: 404, message: 'Connected client not found' })

  const label = normalizeConnectionLabel(body.name)
  await setConnectionLabel(db, grant.id, label, 'owner')
  return { name: label }
})
