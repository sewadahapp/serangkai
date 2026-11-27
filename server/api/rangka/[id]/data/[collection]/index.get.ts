import { listDocuments, loadDataRangka, toHttpError } from '../../../../../utils/rangka-data'

export default defineEventHandler(async (event) => {
  const { db, rangka } = await loadDataRangka(event, 'read')
  try {
    return { documents: await listDocuments(db, rangka.id, String(getRouterParam(event, 'collection'))) }
  } catch (error) {
    throw toHttpError(error)
  }
})
