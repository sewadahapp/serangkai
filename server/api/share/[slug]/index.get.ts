import { renderMarkdownContent } from '../../../utils/markdown'
import { normalizeColorMode, withColorMode } from '../../../utils/rangka-color-mode'
import { withRangkaRuntime } from '../../../utils/rangka-runtime'
import { withDocumentTheme, readerTheme } from '../../../utils/rangka-theme'
import { loadSharedRangka } from '../../../utils/share-access'
import { readRangkaBytes } from '../../../utils/rangka-storage'

/**
 * Only real browser navigations should land on the reader page.
 *
 * Iframes (`iframe`), images (`image`), and fetch/XHR (`empty`) must keep
 * getting the raw rangka; redirecting those would make the reader embed
 * itself. Missing `Sec-Fetch-Dest` (older clients, curl) also stays raw.
 */
function isTopLevelNavigation(event: Parameters<Parameters<typeof defineEventHandler>[0]>[0]) {
  return getHeader(event, 'sec-fetch-dest') === 'document'
}

const imageTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

function resolveImageType(metadata: Record<string, any>) {
  const declared = String(metadata.mimeType || '')
  if (declared.startsWith('image/')) return declared
  const extension = String(metadata.filename || '').toLowerCase().split('.').pop() || ''
  return imageTypes[extension] || 'image/png'
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug required' })

  const rangka = await loadSharedRangka(event, slug)
  const key = String(getQuery(event).k || '')
  const suffix = key ? `?k=${encodeURIComponent(key)}` : ''

  // Reader metadata. The page asks for this, so every type needs a shape it can
  // render: Markdown gets HTML, JSON/JavaScript get source, and the embeddable
  // types get a raw URL (with its key) to frame or display.
  if (String(getQuery(event).format || '') === 'json') {
    setHeader(event, 'Cache-Control', 'no-store')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    const base = {
      slug: rangka.slug,
      title: rangka.title,
      type: rangka.type,
      visibility: rangka.visibility,
      updatedAt: rangka.updatedAt,
      filename: rangka.metadata?.filename,
    }

    if (rangka.type === 'markdown') {
      const content = await readRangkaBytes(rangka.contentPath)
      const markdown = await renderMarkdownContent(content.toString())
      return { ...base, body: markdown.body, toc: markdown.toc, startsWithHeading: markdown.startsWithHeading }
    }

    if (rangka.type === 'json' || rangka.type === 'javascript') {
      const content = await readRangkaBytes(rangka.contentPath)
      return { ...base, content: content.toString() }
    }

    const rawPath = rangka.type === 'bundle'
      ? `/api/share/${rangka.slug}/index.html`
      : `/api/share/${rangka.slug}`
    return { ...base, rawUrl: `${rawPath}${suffix}` }
  }

  // Markdown has no raw use case, so it always redirects to the reader. The
  // other types keep serving raw bytes for iframes and direct fetches, and only
  // send a browser navigation to the reader so it gets the same chrome.
  if (rangka.type === 'markdown' || isTopLevelNavigation(event)) {
    setHeader(event, 'Cache-Control', 'no-store')
    return sendRedirect(event, `/share/${encodeURIComponent(slug)}${suffix}`, 302)
  }

  const content = await readRangkaBytes(rangka.contentPath)

  if (rangka.type === 'html') {
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    // `frame-ancestors 'self'` lets the reader frame this; the sandbox still
    // denies same-origin access, forms, popups, framing outsiders, and network.
    setHeader(event, 'Content-Security-Policy', "sandbox allow-scripts; default-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https: data:; connect-src 'none'; frame-ancestors 'self'; form-action 'none'")
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    // No parent frame to message, so bake the requested mode in and let the
    // client's prefers-color-scheme take over afterwards.
    setHeader(event, 'Vary', 'Sec-CH-Prefers-Color-Scheme')
    setHeader(event, 'Accept-CH', 'Sec-CH-Prefers-Color-Scheme')
    return withRangkaRuntime(withDocumentTheme(withColorMode(content.toString(), normalizeColorMode(getHeader(event, 'sec-ch-prefers-color-scheme'))), readerTheme(event)))
  }

  if (rangka.type === 'json') {
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    return content.toString()
  }
  if (rangka.type === 'pdf') {
    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    return content
  }
  if (rangka.type === 'image') {
    // Uploaded SVGs are documents, not inert bitmaps: opening one at the top
    // level would execute its scripts on the app origin. The sandbox CSP keeps
    // the bytes usable inside <img> while denying scripts and same-origin
    // access when navigated to directly. `metadata.mimeType` is author-supplied
    // on the REST path, so only an `image/*` value is honored; anything else
    // falls back to the filename extension and finally to PNG so existing
    // image rangka keep rendering.
    const declared = String(rangka.metadata?.mimeType || '')
    const contentType = declared.startsWith('image/')
      ? declared
      : resolveImageType(rangka.metadata || {})
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'")
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'Content-Disposition', 'inline')
    return content
  }

  setHeader(event, 'Content-Type', 'text/plain')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return content.toString()
})
