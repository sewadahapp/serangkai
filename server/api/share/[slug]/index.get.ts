import { getRequestStorage } from '#serangkai-storage-runtime'
import { renderMarkdownAsync } from '../../../utils/markdown'
import { normalizeColorMode, withColorMode } from '../../../utils/artifact-color-mode'
import { loadSharedArtifact } from '../../../utils/share-access'

export default defineEventHandler(async (event) => {
  const storage = getRequestStorage(event)
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug required' })

  const artifact = await loadSharedArtifact(event, slug)
  const content = await storage.read(artifact.contentPath)

  if (artifact.type === 'html') {
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    setHeader(event, 'Content-Security-Policy', "sandbox allow-scripts; default-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' https: data:; font-src https: data:; connect-src 'none'; frame-ancestors 'none'; form-action 'none'")
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    // No parent frame to message, so bake the requested mode in and let the
    // client's prefers-color-scheme take over afterwards.
    setHeader(event, 'Vary', 'Sec-CH-Prefers-Color-Scheme')
    setHeader(event, 'Accept-CH', 'Sec-CH-Prefers-Color-Scheme')
    return withColorMode(content.toString(), normalizeColorMode(getHeader(event, 'sec-ch-prefers-color-scheme')))
  }

  if (artifact.type === 'markdown') {
    const key = String(getQuery(event).k || '')
    const suffix = key ? `?k=${encodeURIComponent(key)}` : ''

    // The reader page is a real Nuxt page so shared Markdown uses the same
    // prose styles, Shiki output, Mermaid renderer, and charts as the app.
    // `format=json` is the data source for that page; plain requests redirect.
    if (String(getQuery(event).format || '') !== 'json') {
      setHeader(event, 'Cache-Control', 'no-store')
      return sendRedirect(event, `/share/${encodeURIComponent(slug)}${suffix}`, 302)
    }

    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    return {
      slug: artifact.slug,
      title: artifact.title,
      type: artifact.type,
      visibility: artifact.visibility,
      updatedAt: artifact.updatedAt,
      renderedContent: await renderMarkdownAsync(content.toString()),
    }
  }

  if (artifact.type === 'json') {
    setHeader(event, 'Content-Type', 'application/json')
    return content.toString()
  }
  if (artifact.type === 'pdf') {
    setHeader(event, 'Content-Type', 'application/pdf')
    return content
  }
  if (artifact.type === 'image') {
    setHeader(event, 'Content-Type', artifact.metadata?.mimeType || 'image/png')
    return content
  }

  setHeader(event, 'Content-Type', 'text/plain')
  return content.toString()
})
