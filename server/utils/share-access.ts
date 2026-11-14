import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { rangkaItems } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { isValidShareKey } from './share'

/**
 * Single authorization path for shared rangka.
 *
 * Raw delivery, the rendered reader page, and bundle assets all use this, so
 * visibility rules cannot drift apart and a new delivery surface cannot
 * accidentally skip the private/unlisted check.
 */
export async function loadSharedRangka(event: H3Event, slug: string) {
  const db = await getRequestDatabase(event)
  const rangka = await db.select().from(rangkaItems).where(eq(rangkaItems.slug, slug)).get()
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })

  const key = String(getQuery(event).k || '')
  if (rangka.visibility === 'private') {
    const user = event.context.user
    if (!user || user.id !== rangka.userId) throw createError({ statusCode: 403, message: 'Forbidden' })
  } else if (rangka.visibility === 'unlisted' && !isValidShareKey(rangka.id, key)) {
    throw createError({ statusCode: 404, message: 'Rangka not found' })
  }

  return rangka
}
