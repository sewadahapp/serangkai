import { clearDocuments, loadDataRangka } from '../../../../utils/rangka-data'

/** Deletes every document the rangka holds, so an interactive rangka starts fresh. */
export default defineEventHandler(async (event) => {
  const { db, rangka } = await loadDataRangka(event, 'write')
  return await clearDocuments(db, rangka.id)
})
