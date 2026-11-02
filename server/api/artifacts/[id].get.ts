import { db, artifacts } from '../../db'
import { storage } from '../../storage'
import { eq } from 'drizzle-orm'
import { renderMarkdown } from '../../utils/markdown'

export default defineEventHandler(async (event) => {
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
  
  const content = await storage.read(artifact.contentPath)
  
  return { 
    artifact: { 
      id: artifact.id, 
      slug: artifact.slug, 
      title: artifact.title, 
      type: artifact.type,
      visibility: artifact.visibility,
      metadata: artifact.metadata,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt
    },
    content: content.toString(),
    renderedContent: artifact.type === 'markdown' ? renderMarkdown(content.toString()) : null
  }
})
