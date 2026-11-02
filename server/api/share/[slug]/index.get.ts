import { db, artifacts } from '../../../db'
import { storage } from '../../../storage'
import { eq } from 'drizzle-orm'
import { renderMarkdown } from '../../../utils/markdown'

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
    setHeader(event, 'Content-Security-Policy', "sandbox allow-scripts; default-src 'self' https: data:; connect-src 'none'; frame-ancestors 'none'; form-action 'none'")
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    return content.toString()
  } else if (artifact.type === 'markdown') {
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    setHeader(event, 'Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https: data:; base-uri 'none'; frame-ancestors 'none'")
    return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${artifact.title}</title><style>body{font-family:system-ui;max-width:760px;margin:3rem auto;padding:0 1.25rem;line-height:1.7;color:#202124}pre{white-space:pre-wrap}h1,h2,h3{line-height:1.2}code{background:#f1f3f4;padding:.15rem .3rem;border-radius:.25rem}</style></head><body>${renderMarkdown(content.toString())}</body></html>`
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
