import { eq } from 'drizzle-orm'
import { rangkaItems } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireUser } from '../../../utils/require-auth'
import { isValidShareKey } from '../../../utils/share'
import { readRangkaBytes } from '../../../utils/rangka-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = event.context.user
  const id = getRouterParam(event, 'id')
  const rangka = await db.select().from(rangkaItems).where(eq(rangkaItems.id, id || '')).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })

  if (rangka.visibility === 'private') {
    requireUser(event)
    if (rangka.userId !== user?.id) throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  if (rangka.visibility === 'unlisted' && rangka.userId !== user?.id) {
    // An unlisted rangka is only reachable through its signed capability
    // link. Knowing the opaque id is not authorization.
    const key = String(getQuery(event).k || '')
    if (!isValidShareKey(rangka.id, key)) {
      throw createError({ statusCode: 404, message: 'Rangka not found' })
    }
  }

  setHeader(event, 'Cache-Control', rangka.visibility === 'public' ? 'public, max-age=60' : 'private, no-store')
  const content = await readRangkaBytes(rangka.contentPath)
  const metadata = rangka.metadata || {}
  setHeader(event, 'Content-Type', metadata.mimeType || 'application/octet-stream')
  setHeader(event, 'Content-Disposition', `attachment; filename="${String(metadata.filename || rangka.slug).replace(/[^a-zA-Z0-9._-]/g, '_')}"`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return content
})
