import { db, artifacts } from '../../../db'
import { storage } from '../../../storage'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Slug required' })
  }
  
  const artifact = await db.select().from(artifacts).where(eq(artifacts.slug, slug)).get()
  if (!artifact) {
    throw createError({ statusCode: 404, message: 'Artifact not found' })
  }
  
  if (artifact.visibility === 'private') {
    const user = event.context.user
    if (!user || user.id !== artifact.userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
  }
  
  const content = await storage.read(artifact.contentPath)
  
  if (artifact.type === 'html') {
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    return content.toString()
  } else if (artifact.type === 'markdown') {
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    return `<html><head><title>${artifact.title}</title></head><body><pre>${content.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`
  } else if (artifact.type === 'json') {
    setHeader(event, 'Content-Type', 'application/json')
    return content.toString()
  } else if (artifact.type === 'pdf') {
    setHeader(event, 'Content-Type', 'application/pdf')
    return content
  } else if (artifact.type === 'image') {
    setHeader(event, 'Content-Type', artifact.metadata?.mimeType || 'image/png')
    return content
  }
  
  setHeader(event, 'Content-Type', 'text/plain')
  return content.toString()
})
