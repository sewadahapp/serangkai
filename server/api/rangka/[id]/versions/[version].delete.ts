import { rangkaItems } from '../../../../db/schema'
import { getRequestDatabase } from '../../../../db/adapter'
import { requireSessionUser } from '../../../../utils/require-auth'
import { and, eq } from 'drizzle-orm'
import { deleteVersion } from '../../../../utils/version-pruning'

/**
 * Delete one saved version. Browser session only: history is the owner's
 * safety net against an agent's bad writes, so an API token cannot erase it.
 */
export default defineEventHandler(async (event) => {
  const user = requireSessionUser(event)
  const db = await getRequestDatabase(event)
  const id = getRouterParam(event, 'id')
  const versionNumber = Number(getRouterParam(event, 'version'))
  if (!id || !Number.isInteger(versionNumber) || versionNumber < 1) {
    throw createError({ statusCode: 400, message: 'Rangka id and a positive version number are required' })
  }

  const rangka = await db.select().from(rangkaItems)
    .where(and(eq(rangkaItems.id, id), eq(rangkaItems.userId, user.id))).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })

  const outcome = await deleteVersion(db, rangka, versionNumber)
  if (!outcome.ok) {
    if (outcome.reason === 'not_found') throw createError({ statusCode: 404, message: 'Version not found' })
    if (outcome.reason === 'current') throw createError({ statusCode: 409, message: 'The current version cannot be deleted.' })
    throw createError({ statusCode: 409, message: 'The first version of a bundle holds its files and cannot be deleted.' })
  }
  return { deleted: versionNumber, freedBytes: outcome.freedBytes }
})
