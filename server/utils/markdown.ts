import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

export function renderMarkdown(source: string) {
  const html = marked.parse(source, { async: false, gfm: true, breaks: true }) as string
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['details', 'summary', 'kbd', 'del', 'ins']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  })
}
