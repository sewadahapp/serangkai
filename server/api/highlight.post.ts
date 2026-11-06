import { highlightCode, normalizeLanguage, stripShikiPre } from '../utils/highlight'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function sanitizeCodeHtml(html: string) {
  // Only Shiki-shaped markup is expected: <pre><code><span class style>.
  // Strip anything else so this endpoint can never echo author-supplied tags.
  return html
    .replace(/<(?!\/?(?:pre|code|span)\b)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

/**
 * Server-side highlighting for code the app itself renders (MCP snippets, API
 * examples). Mirrors the Markdown path so both share one highlighter and one
 * set of styles.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const code = typeof body?.code === 'string' ? body.code : ''
  const language = normalizeLanguage(typeof body?.lang === 'string' ? body.lang : '')
  if (!code) return { html: '', language, highlighted: false }

  // Public endpoint: bound the work a single request can request. App-owned
  // snippets are tiny; anything larger degrades to plain text client-side.
  if (code.length > 50_000) {
    throw createError({ statusCode: 413, statusMessage: 'Code snippet is too large to highlight.' })
  }

  const highlighted = await highlightCode(code, language)
  return {
    html: highlighted ? sanitizeCodeHtml(stripShikiPre(highlighted)) : `<code>${escapeHtml(code)}</code>`,
    language,
    highlighted: Boolean(highlighted),
  }
})
