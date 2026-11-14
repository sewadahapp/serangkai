import { rangkaVersions, rangkaItems } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireUser } from '../../../utils/require-auth'
import { and, count, desc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  const rangka = await db.select().from(rangkaItems)
    .where(and(eq(rangkaItems.id, id || ''), eq(rangkaItems.userId, user.id))).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })
  const fields = { id: rangkaVersions.id, version: rangkaVersions.version, metadata: rangkaVersions.metadata, createdAt: rangkaVersions.createdAt }
  const query = getQuery(event)
  // Preserve the existing unpaginated response for API consumers.
  if (query.page === undefined) {
    const versions = await db.select(fields).from(rangkaVersions)
      .where(eq(rangkaVersions.rangkaId, rangka.id)).orderBy(desc(rangkaVersions.version))
    return { versions }
  }
  const requestedPage = Number(query.page)
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 1000000) {
    throw createError({ statusCode: 400, message: 'Invalid page' })
  }
  const pageSize = 8
  const [counts, latest] = await Promise.all([
    db.select({ value: count() }).from(rangkaVersions).where(eq(rangkaVersions.rangkaId, rangka.id)),
    db.select({ version: rangkaVersions.version }).from(rangkaVersions).where(eq(rangkaVersions.rangkaId, rangka.id)).orderBy(desc(rangkaVersions.version)).limit(1),
  ])
  const total = counts[0]?.value || 0
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)))
  const versions = await db.select(fields).from(rangkaVersions).where(eq(rangkaVersions.rangkaId, rangka.id))
    .orderBy(desc(rangkaVersions.version)).limit(pageSize).offset((page - 1) * pageSize)
  return { versions, total, page, pageSize, latestVersion: latest[0]?.version ?? null }
})
