import { nanoid } from 'nanoid'
import { rangkaVersions, rangkaItems, folders } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireScope } from '../../utils/require-auth'
import { rangkaTypes, inferRangkaType, reserveSlug, MAX_UPLOAD_BYTES } from '../../utils/rangka'
import { isSlugConflict } from '../../db/migrations'
import { deleteBundle, extractBundle } from '../../utils/bundles'
import { assertStorageAvailable, storageWriteRefusal } from '../../utils/storage-quota'
import { and, eq } from 'drizzle-orm'
import { writeRangka } from '../../utils/rangka-storage'

const allowedMimeTypes = new Set([
  'text/markdown', 'text/plain', 'text/html', 'text/javascript', 'application/javascript',
  'application/json', 'application/pdf', 'application/zip', 'application/x-zip-compressed',
  'application/octet-stream',
])

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.data)
  if (!file?.data?.length) throw createError({ statusCode: 400, message: 'A file is required' })
  if (file.data.length > MAX_UPLOAD_BYTES) throw createError({ statusCode: 413, message: 'File exceeds the 25 MiB limit' })

  const titlePart = parts?.find(part => part.name === 'title')
  const typePart = parts?.find(part => part.name === 'type')
  const visibilityPart = parts?.find(part => part.name === 'visibility')
  const folderPart = parts?.find(part => part.name === 'folderId')
  const title = titlePart?.data?.toString().trim() || file.filename || 'Uploaded rangka'
  const type = (typePart?.data?.toString() || inferRangkaType(file.filename || '', file.type || '')) as typeof rangkaTypes[number]
  const visibility = visibilityPart?.data?.toString() || 'private'
  const folderId = folderPart?.data?.toString() || null

  if (folderId) {
    const folder = await db.select().from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, user.id))).get()
    if (!folder) throw createError({ statusCode: 400, message: 'Folder not found' })
  }

  if (!rangkaTypes.includes(type)) throw createError({ statusCode: 400, message: 'Unsupported rangka type' })
  if (!['private', 'public', 'unlisted'].includes(visibility)) throw createError({ statusCode: 400, message: 'Invalid visibility' })
  if (file.type && !allowedMimeTypes.has(file.type) && !file.type.startsWith('image/')) throw createError({ statusCode: 415, message: 'Unsupported file type' })
  if (type === 'image' && !file.type?.startsWith('image/')) throw createError({ statusCode: 415, message: 'Image uploads require an image MIME type' })

  await assertStorageAvailable(db, user.id, file.data.length)

  const id = nanoid()
  const slug = await reserveSlug(db, title)
  const contentPath = `${user.id}/${id}/content`
  let storedBytes = file.data.length
  if (type === 'bundle') {
    const prefix = `${user.id}/${id}/bundle`
    let unpacked: { bytes: number }
    try { unpacked = await extractBundle(file.data, prefix) as { bytes: number } }
    catch (error: any) {
      await deleteBundle(prefix).catch(() => {})
      throw createError({ statusCode: 400, message: error.message || 'Invalid static bundle' })
    }
    // The unpacked size is only known after reading the archive, so check the
    // full footprint again and remove the files if it does not fit.
    storedBytes += unpacked.bytes
    const refusal = await storageWriteRefusal(db, user.id, storedBytes)
    if (refusal) {
      await deleteBundle(prefix).catch(() => {})
      throw createError({ statusCode: 507, message: refusal })
    }
    await writeRangka(contentPath, file.data)
  } else {
    await writeRangka(contentPath, file.data)
  }
  try {
    await db.insert(rangkaItems).values({
      id, userId: user.id, folderId, slug, title, type,
      visibility: visibility as 'private' | 'public' | 'unlisted', contentPath,
      metadata: { filename: file.filename, mimeType: file.type, size: file.data.length }, createdAt: new Date(), updatedAt: new Date(),
    })
  } catch (error) {
    if (isSlugConflict(error)) throw createError({ statusCode: 409, message: 'That share identifier is already in use. Retry the upload.' })
    throw error
  }
  await db.insert(rangkaVersions).values({ id: nanoid(), rangkaId: id, version: 1, contentPath, metadata: {}, storedBytes, createdAt: new Date() })
  return { rangka: { id, slug, title, type, visibility, folderId, size: file.data.length } }
})
