import { deleteDocument, loadDataRangka, toHttpError } from '../../../../../utils/rangka-data'

export default defineEventHandler(async (event) => {
  const { db, rangka } = await loadDataRangka(event, 'write')
  try {
    const deleted = await deleteDocument(db, rangka.id, String(getRouterParam(event, 'collection')), String(getRouterParam(event, 'docId')))
    return { deleted }
  } catch (error) {
    throw toHttpError(error)
  }
})
