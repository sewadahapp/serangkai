import { getDocument, loadDataRangka, toHttpError } from '../../../../../utils/rangka-data'

export default defineEventHandler(async (event) => {
  const { db, rangka } = await loadDataRangka(event, 'read')
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
