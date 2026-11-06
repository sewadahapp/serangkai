import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { highlightCode, normalizeLanguage, stripShikiPre } from './highlight'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

/**
 * Wraps highlighted HTML in the same structure `SProsePre` renders, so Markdown
 * output matches the component's chrome: a language header with a file icon and
 * a copy button, plus the shared pre surface.
 *
 * The copy button is progressive enhancement — it only works once hydrated, so
 * it is wired by `code-copy.client.ts` rather than rendered inert.
 */
function renderCodeBlock(inner: string, lang: string) {
  const language = normalizeLanguage(lang)
  const label = language ? escapeHtml(language) : ''
  return `<div class="serangkai-code" data-language="${label}">`
    + '<div class="serangkai-code-header">'
    + `<span class="serangkai-code-language">${label || 'text'}</span>`
    + '<button type="button" class="serangkai-code-copy" data-serangkai-copy aria-label="Copy code">Copy</button>'
    + '</div>'
    + `<pre class="serangkai-code-pre shiki">${inner}</pre>`
    + '</div>'
}

function renderInteractiveFence(code: string, language = '') {
  const lang = language.toLowerCase()
  if (lang === 'mermaid') {
    return `<div class="serangkai-mermaid" data-mermaid="${escapeHtml(code)}"><pre>${escapeHtml(code)}</pre></div>`
  }
  if (lang === 'chart' || lang === 'chartjson') {
    try {
      const definition = JSON.parse(code)
      return `<div class="serangkai-chart" data-chart="${escapeHtml(JSON.stringify(definition))}"><pre>${escapeHtml(JSON.stringify(definition, null, 2))}</pre></div>`
    } catch {
      return `<pre class="serangkai-chart-error"><code>${escapeHtml(code)}</code></pre>`
    }
  }
  return ''
}

export interface RenderMarkdownOptions {
  /** Set false to skip Shiki (used where a sync result is required). */
  highlight?: boolean
}

export async function renderMarkdownAsync(source: string, options: RenderMarkdownOptions = {}): Promise<string> {
  const useHighlight = options.highlight !== false
  const fences: Array<{ inner: string; lang: string }> = []

  const renderer = new marked.Renderer()
  renderer.code = ({ text, lang }) => {
    const interactive = renderInteractiveFence(text, lang || '')
    if (interactive) return interactive

    const index = fences.length
    fences.push({ inner: escapeHtml(text), lang: lang || '' })
    // Synchronous placeholder swapped out after highlighting; keeps marked sync.
    return `\u0000SERANGKAI_FENCE_${index}\u0000`
  }

  let html = marked.parse(source, { async: false, gfm: true, breaks: true, renderer }) as string

  for (let i = 0; i < fences.length; i++) {
    const fence = fences[i]
    let inner = fence.inner
    if (useHighlight) {
      const highlighted = await highlightCode(
        // the placeholder table stored the escaped form; highlight the raw text
        decodeHtmlEntities(fence.inner),
        fence.lang,
      )
      if (highlighted) inner = stripShikiPre(highlighted)
    }
    html = html.replace(`\u0000SERANGKAI_FENCE_${i}\u0000`, renderCodeBlock(inner, fence.lang))
  }

  return withHeadingIds(sanitize(html))
}

/** Decodes the entities marked emits inside heading text, for slugging. */
function headingText(html: string) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'section'
}

/**
 * Adds stable, unique `id`s to headings.
 *
 * Marked no longer emits heading ids, and `SContentToc` links to `#id`. Doing
 * this after sanitization keeps the generated attribute out of the author's
 * input entirely; the slug is derived from text, so it cannot introduce markup.
 * Duplicate titles get `-2`, `-3`, ... suffixes rather than colliding.
 */
function withHeadingIds(html: string) {
  const used = new Map<string, number>()
  return html.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level: string, attributes: string, inner: string) => {
    if (/\sid\s*=/.test(attributes)) return match
    const base = slugifyHeading(headingText(inner))
    const seen = used.get(base) || 0
    used.set(base, seen + 1)
    const id = seen ? `${base}-${seen + 1}` : base
    return `<h${level}${attributes} id="${id}">${inner}</h${level}>`
  })
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function sanitize(html: string) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['details', 'summary', 'kbd', 'del', 'ins', 'div', 'span', 'button']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      code: ['class'],
      pre: ['class', 'style'],
      span: ['class', 'style'],
      div: ['class', 'data-mermaid', 'data-chart', 'data-language'],
      button: ['type', 'class', 'aria-label', 'data-serangkai-copy'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  })
}

/**
 * Synchronous renderer without syntax highlighting. Kept for callers that
 * cannot await (and for the existing tests); output is still sanitized.
 */
export function renderMarkdown(source: string) {
  const renderer = new marked.Renderer()
  renderer.code = ({ text, lang }) => {
    const interactive = renderInteractiveFence(text, lang || '')
    if (interactive) return interactive
    return renderCodeBlock(`<code>${escapeHtml(text)}</code>`, lang || '')
  }
  const html = marked.parse(source, { async: false, gfm: true, breaks: true, renderer }) as string
  return withHeadingIds(sanitize(html))
}
