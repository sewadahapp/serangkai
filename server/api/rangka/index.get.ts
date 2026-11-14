import { rangkaItems } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { rangkaShareUrlForCaller } from '../../utils/share'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const userRangka = await db.select().from(rangkaItems).where(eq(rangkaItems.userId, user.id))
  // The workspace list shows a preview action for shared rangka. Build the
  // same reader URL the dedicated share endpoint returns, once per rangka,
  // instead of making the browser ask for every row. Unlisted capability keys
  // are withheld from read-only callers (see rangkaShareUrlForCaller).
  return {
    rangka: userRangka.map(rangka => ({
      ...rangka,
      shareUrl: rangkaShareUrlForCaller(event, rangka),
    })),
  }
})
