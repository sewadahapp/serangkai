import { rangkaItems } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireSessionUser } from '../../../utils/require-auth'
import { and, eq } from 'drizzle-orm'
import { CLEAR_BATCH, pruneVersions } from '../../../utils/version-pruning'

/**
 * Clear older versions, keeping only the current one. Removes up to one batch
 * per request; when `remaining` is above zero the caller repeats the request.
 * Browser session only, like deleting a single version.
 */
export default defineEventHandler(async (event) => {
  const user = requireSessionUser(event)
  const db = await getRequestDatabase(event)
  const id = getRouterParam(event, 'id')
  const rangka = await db.select().from(rangkaItems)
    .where(and(eq(rangkaItems.id, id || ''), eq(rangkaItems.userId, user.id))).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })
  return await pruneVersions(db, rangka, 1, CLEAR_BATCH)
})
