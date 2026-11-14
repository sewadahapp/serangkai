import { rangkaVersions, rangkaItems } from '../../../../../db/schema'
import { getRequestDatabase } from '../../../../../db/adapter'
import { requireScope } from '../../../../../utils/require-auth'
import { and, eq, max } from 'drizzle-orm'
import { readRangkaBytes } from '../../../../../utils/rangka-storage'
import { appendVersion } from '../../../../../utils/rangka-versions'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  const versionNumber = Number(getRouterParam(event, 'version'))
  if (!id || !Number.isInteger(versionNumber) || versionNumber < 1) {
    throw createError({ statusCode: 400, message: 'Rangka id and a positive version number are required' })
  }

  const rangka = await db.select().from(rangkaItems)
    .where(and(eq(rangkaItems.id, id), eq(rangkaItems.userId, user.id))).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })

  const source = await db.select().from(rangkaVersions)
    .where(and(eq(rangkaVersions.rangkaId, rangka.id), eq(rangkaVersions.version, versionNumber))).get()
  if (!source) throw createError({ statusCode: 404, message: 'Version not found' })

  // Restoring never rewrites history: the old content becomes a brand-new
  // version so the rangka timeline stays append-only.
  const latest = await db.select({ value: max(rangkaVersions.version) })
    .from(rangkaVersions).where(eq(rangkaVersions.rangkaId, rangka.id)).get()
  const version = Number(latest?.value || 0) + 1
  const contentPath = `${user.id}/${rangka.id}/versions/${version}`
  const content = await readRangkaBytes(source.contentPath)
  const claimed = await appendVersion(db, {
    rangkaId: rangka.id, version, contentPath, metadata: source.metadata || {}, content,
  })
  if (!claimed) {
    throw createError({ statusCode: 409, message: 'Another change was published at the same time. Reload the history and try again.' })
  }

  const now = new Date()
  await db.update(rangkaItems).set({ contentPath, updatedAt: now })
    .where(and(eq(rangkaItems.id, rangka.id), eq(rangkaItems.userId, user.id)))

  return { version, restoredFrom: source.version, rangka: { ...rangka, contentPath, updatedAt: now } }
})
