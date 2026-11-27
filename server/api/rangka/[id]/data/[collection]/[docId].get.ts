import { getDocument, loadDataRangka, toHttpError } from '../../../../../utils/rangka-data'

export default defineEventHandler(async (event) => {
  const { db, rangka } = await loadDataRangka(event, 'read')
  let document
  try {
    document = await getDocument(db, rangka.id, String(getRouterParam(event, 'collection')), String(getRouterParam(event, 'docId')))
  } catch (error) {
    throw toHttpError(error)
  }
  if (!document) throw createError({ statusCode: 404, message: 'Document not found' })
  return { document }
})
