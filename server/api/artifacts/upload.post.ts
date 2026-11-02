import { nanoid } from 'nanoid'
import { db, artifactVersions, artifacts } from '../../db'
import { storage } from '../../storage'
import { requireScope } from '../../utils/require-auth'
import { artifactTypes, inferArtifactType, makeSlug, MAX_UPLOAD_BYTES } from '../../utils/artifacts'

const allowedMimeTypes = new Set([
  'text/markdown', 'text/plain', 'text/html', 'text/javascript', 'application/javascript',
  'application/json', 'application/pdf', 'application/zip', 'application/x-zip-compressed',
  'application/octet-stream',
])

export default defineEventHandler(async (event) => {
  const user = requireScope(event, 'write')
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.data)
  if (!file?.data?.length) throw createError({ statusCode: 400, message: 'A file is required' })
  if (file.data.length > MAX_UPLOAD_BYTES) throw createError({ statusCode: 413, message: 'File exceeds the 25 MiB limit' })

  const titlePart = parts?.find(part => part.name === 'title')
  const typePart = parts?.find(part => part.name === 'type')
  const visibilityPart = parts?.find(part => part.name === 'visibility')
  const folderPart = parts?.find(part => part.name === 'folderId')
  const title = titlePart?.data?.toString().trim() || file.filename || 'Uploaded artifact'
  const type = (typePart?.data?.toString() || inferArtifactType(file.filename || '', file.type || '')) as typeof artifactTypes[number]
  const visibility = visibilityPart?.data?.toString() || 'private'

  if (!artifactTypes.includes(type)) throw createError({ statusCode: 400, message: 'Unsupported artifact type' })
  if (!['private', 'public', 'unlisted'].includes(visibility)) throw createError({ statusCode: 400, message: 'Invalid visibility' })
  if (file.type && !allowedMimeTypes.has(file.type) && !file.type.startsWith('image/')) throw createError({ statusCode: 415, message: 'Unsupported file type' })
  if (type === 'image' && !file.type?.startsWith('image/')) throw createError({ statusCode: 415, message: 'Image uploads require an image MIME type' })

  const id = nanoid()
  const slug = makeSlug(title)
  const contentPath = `${user.id}/${id}/content`
  await storage.save(contentPath, file.data)
  await db.insert(artifacts).values({
    id, userId: user.id, folderId: folderPart?.data?.toString() || null, slug, title, type,
    visibility: visibility as 'private' | 'public' | 'unlisted', contentPath,
    metadata: { filename: file.filename, mimeType: file.type, size: file.data.length }, createdAt: new Date(), updatedAt: new Date(),
  })
  await db.insert(artifactVersions).values({ id: nanoid(), artifactId: id, version: 1, contentPath, metadata: {}, createdAt: new Date() })
  return { artifact: { id, slug, title, type, visibility, size: file.data.length } }
})
