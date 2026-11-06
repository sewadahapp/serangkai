import { artifacts } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { getRequestStorage } from '#serangkai-storage-runtime'
import { eq } from 'drizzle-orm'
import { renderMarkdownAsync } from '../../utils/markdown'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const storage = getRequestStorage(event)
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID required' })
  }
  
  const artifact = await db.select().from(artifacts).where(eq(artifacts.id, id)).get()
  if (!artifact || artifact.userId !== user.id) {
    throw createError({ statusCode: 404, message: 'Artifact not found' })
  }
  
  // Binary artifacts are previewed/downloaded through dedicated endpoints;
  // do not inflate them into a string for the metadata response.
  const isBinary = artifact.type === 'image' || artifact.type === 'pdf' || artifact.type === 'bundle'
  const content = isBinary ? Buffer.alloc(0) : await storage.read(artifact.contentPath)
  
  return { 
    artifact: { 
      id: artifact.id, 
      slug: artifact.slug, 
      title: artifact.title, 
      type: artifact.type,
      visibility: artifact.visibility,
      folderId: artifact.folderId,
      metadata: artifact.metadata,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt
    },
    content: content.toString(),
    renderedContent: artifact.type === 'markdown' ? await renderMarkdownAsync(content.toString()) : null
  }
})
