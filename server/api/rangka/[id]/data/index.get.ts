import { listCollections, loadDataRangka } from '../../../../utils/rangka-data'

/** The collections a rangka's data holds, with document counts and sizes. */
export default defineEventHandler(async (event) => {
  const { db, rangka } = await loadDataRangka(event, 'read')
  return { collections: await listCollections(db, rangka.id) }
})
