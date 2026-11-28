import { loadDataRangka, readDocumentBody, requestWriter, toHttpError, writeDocument } from '../../../../../utils/rangka-data'

/** Shallow-merges fields into a document, creating it when missing. */
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
      merge: true,
      writer: requestWriter(event),
    })
    return { document }
  } catch (error) {
    throw toHttpError(error)
  }
})
