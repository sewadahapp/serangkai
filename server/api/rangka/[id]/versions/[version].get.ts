import { rangkaVersions, rangkaItems } from '../../../../db/schema'
import { getRequestDatabase } from '../../../../db/adapter'
import { requireUser } from '../../../../utils/require-auth'
import { and, eq } from 'drizzle-orm'
import { readRangkaBytes } from '../../../../utils/rangka-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  const versionNumber = Number(getRouterParam(event, 'version'))
  if (!id || !Number.isInteger(versionNumber) || versionNumber < 1) {
    throw createError({ statusCode: 400, message: 'Rangka id and a positive version number are required' })
  }

  const rangka = await db.select().from(rangkaItems)
    .where(and(eq(rangkaItems.id, id), eq(rangkaItems.userId, user.id))).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })

  const version = await db.select().from(rangkaVersions)
    .where(and(eq(rangkaVersions.rangkaId, rangka.id), eq(rangkaVersions.version, versionNumber))).get()
  if (!version) throw createError({ statusCode: 404, message: 'Version not found' })

  const content = await readRangkaBytes(version.contentPath)
  return {
    version: { id: version.id, version: version.version, createdAt: version.createdAt },
    content: content.toString(),
  }
})
