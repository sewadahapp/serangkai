import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function renderInteractiveFence(code: string, language = '') {
  if (language.toLowerCase() === 'mermaid') {
    return `<div class="serangkai-mermaid" data-mermaid="${escapeHtml(code)}"><pre>${escapeHtml(code)}</pre></div>`
  }
  if (language.toLowerCase() === 'chart' || language.toLowerCase() === 'chartjson') {
    try {
      const definition = JSON.parse(code)
      return `<div class="serangkai-chart" data-chart="${escapeHtml(JSON.stringify(definition))}"><pre>${escapeHtml(JSON.stringify(definition, null, 2))}</pre></div>`
    } catch {
      return `<pre class="serangkai-chart-error"><code>${escapeHtml(code)}</code></pre>`
    }
  }
  return ''
}

export function renderMarkdown(source: string) {
  const renderer = new marked.Renderer()
  renderer.code = ({ text, lang }) => renderInteractiveFence(text, lang) || `<pre><code class="language-${escapeHtml(lang || '')}">${escapeHtml(text)}</code></pre>`
  const html = marked.parse(source, { async: false, gfm: true, breaks: true, renderer }) as string
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['details', 'summary', 'kbd', 'del', 'ins', 'div']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      code: ['class'],
      pre: ['class'],
      div: ['class', 'data-mermaid', 'data-chart'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  })
}
