import { and, eq } from 'drizzle-orm'
import { rangkaItems } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireScope } from '../../../utils/require-auth'
import { rangkaShareUrl } from '../../../utils/share'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  // Generating a capability URL is a write operation: a read-only agent must
  // not be able to create a public/unlisted entry point.
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  const rangka = await db.select().from(rangkaItems).where(and(eq(rangkaItems.id, id || ''), eq(rangkaItems.userId, user.id))).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })
  // Every type opens in the reader so shared links get the same chrome.
  const url = rangkaShareUrl(event, rangka)
  if (!url) throw createError({ statusCode: 400, message: 'Private rangka do not have a share link' })
  return { slug: rangka.slug, visibility: rangka.visibility, url }
})
