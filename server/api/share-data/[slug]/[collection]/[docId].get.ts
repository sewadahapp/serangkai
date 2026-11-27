import { getRequestDatabase } from '../../../../db/adapter'
import { getDocument, toHttpError } from '../../../../utils/rangka-data'
import { loadSharedRangka } from '../../../../utils/share-access'

/** One document of a shared rangka; read-only, same access rules as the share. */
export default defineEventHandler(async (event) => {
  const rangka = await loadSharedRangka(event, String(getRouterParam(event, 'slug')))
  const db = await getRequestDatabase(event)
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  let document
  try {
    document = await getDocument(db, rangka.id, String(getRouterParam(event, 'collection')), String(getRouterParam(event, 'docId')))
  } catch (error) {
    throw toHttpError(error)
  }
  if (!document) throw createError({ statusCode: 404, message: 'Document not found' })
  return { document }
})
