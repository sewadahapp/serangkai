import { getRequestDatabase } from '../../../../db/adapter'
import { keepsData, getDocument, toHttpError } from '../../../../utils/rangka-data'
import { loadSharedRangka } from '../../../../utils/share-access'

/** One document of a shared rangka; read-only, same access rules as the share. */
export default defineEventHandler(async (event) => {
  const rangka = await loadSharedRangka(event, String(getRouterParam(event, 'slug')))
  // Only HTML rangka have a page that shows data; nothing else is published.
  if (!keepsData(rangka)) throw createError({ statusCode: 404, message: 'Not found' })
  const db = await getRequestDatabase(event)
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  let document
  try {
    document = await getDocument(db, rangka.id, String(getRouterParam(event, 'collection')), String(getRouterParam(event, 'docId')))
  } catch (error) {
    throw toHttpError(error)
  }
  // `?optional=1` answers a missing document with null instead of a 404, so the
  // in-page bridge can probe for a document without a console error.
  if (!document && getQuery(event).optional === '1') return { document: null }
  if (!document) throw createError({ statusCode: 404, message: 'Document not found' })
  return { document }
})
