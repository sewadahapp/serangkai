import { loadDataRangka, readDocumentBody, requestWriter, toHttpError, writeDocument } from '../../../../../utils/rangka-data'

/** Creates or replaces a document. */
export default defineEventHandler(async (event) => {
  const { db, user, rangka } = await loadDataRangka(event, 'write')
  const data = await readDocumentBody(event)
  try {
    const document = await writeDocument(db, {
      userId: user.id,
      rangkaId: rangka.id,
      collection: String(getRouterParam(event, 'collection')),
      docId: String(getRouterParam(event, 'docId')),
      data,
      merge: false,
      writer: requestWriter(event),
    })
    return { document }
  } catch (error) {
    throw toHttpError(error)
  }
})
