/**
 * Opt-in document theme for sandboxed HTML artifacts.
 *
 * HTML artifacts are self-styled by default. This only activates when the
 * artifact explicitly declares:
 *
 *   <meta name="serangkai-theme" content="selaras-document">
 *
 * The stylesheet is generated from Selaras' prose CSS by
 * `scripts/build-artifact-runtime.ts` and served locally. It provides document
 * typography and colors only; it does not inject Vue or make Selaras components
 * available inside the artifact.
 */

export const DOCUMENT_THEME = 'selaras-document'
export const DOCUMENT_THEME_PATH = '/artifact-themes/selaras-document.css'

const THEME_META = /<meta[^>]+name=["']serangkai-theme["'][^>]*>/i

export function wantsDocumentTheme(content: string) {
  const meta = content.match(THEME_META)?.[0]
  if (!meta) return false
  const value = meta.match(/content=["']([^"']+)["']/i)?.[1] || ''
  return value.split(/\s+/).includes(DOCUMENT_THEME)
}

/** Injects the theme link once; respects an existing explicit link. */
export function withDocumentTheme(content: string) {
  if (!wantsDocumentTheme(content)) return content
  if (/data-serangkai-document-theme\b/i.test(content)) return content

  const tag = `<link rel="stylesheet" href="${DOCUMENT_THEME_PATH}" data-serangkai-document-theme>`
  if (/<head[^>]*>/i.test(content)) {
    return content.replace(/<head[^>]*>/i, head => `${head}${tag}`)
  }
  if (/<html[^>]*>/i.test(content)) {
    return content.replace(/<html[^>]*>/i, html => `${html}<head>${tag}</head>`)
  }
  return tag + content
}
