import { getRequestDatabase } from '../../../../db/adapter'
import { listDocuments, toHttpError } from '../../../../utils/rangka-data'
import { loadSharedRangka } from '../../../../utils/share-access'

/**
 * Read-only data for a shared rangka, so a published board shows its cards.
 * Access follows the share rules exactly (private needs the owner, unlisted
 * needs the key). It sits outside /api/share/:slug/ because that prefix serves
 * bundle files, which may well include a data/ folder of their own.
 */
export default defineEventHandler(async (event) => {
  const rangka = await loadSharedRangka(event, String(getRouterParam(event, 'slug')))
  const db = await getRequestDatabase(event)
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  try {
    return { documents: await listDocuments(db, rangka.id, String(getRouterParam(event, 'collection'))) }
  } catch (error) {
    throw toHttpError(error)
  }
})
