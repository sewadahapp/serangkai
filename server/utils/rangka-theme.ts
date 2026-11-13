/**
 * Opt-in document theme for sandboxed HTML rangka.
 *
 * HTML rangka are self-styled by default. This only activates when the
 * rangka explicitly declares:
 *
 *   <meta name="serangkai-theme" content="selaras-document">
 *
 * The stylesheet is generated from Selaras' prose CSS by
 * `scripts/build-rangka-runtime.ts` and served locally. It provides document
 * typography and colors only; it does not inject Vue or make Selaras components
 * available inside the rangka.
 */
import { isThemeId } from '../../shared/themes'

export const DOCUMENT_THEME = 'selaras-document'
export const DOCUMENT_THEME_PATH = '/rangka-themes/selaras-document.css'

const THEME_META = /<meta[^>]+name=["']serangkai-theme["'][^>]*>/i

export function wantsDocumentTheme(content: string) {
  const meta = content.match(THEME_META)?.[0]
  if (!meta) return false
  const value = meta.match(/content=["']([^"']+)["']/i)?.[1] || ''
  return value.split(/\s+/).includes(DOCUMENT_THEME)
}

/**
 * The viewer's active app theme, read from the `serangkai-theme` cookie that
 * `useAppTheme` writes. Both delivery routes are same-origin requests (the
 * preview frame and the share reader's iframe), so the cookie is present and the
 * document theme can resolve tokens against the theme the viewer actually sees.
 */
export function readerTheme(event: any): string | undefined {
  const value = getCookie(event, 'serangkai-theme')
  return isThemeId(value) ? value : undefined
}

/** Injects the theme link once; respects an existing explicit link. */
export function withDocumentTheme(content: string, themeId?: string) {
  if (!wantsDocumentTheme(content)) return content
  if (/data-serangkai-document-theme\b/i.test(content)) return content

  const tag = `<link rel="stylesheet" href="${DOCUMENT_THEME_PATH}" data-serangkai-document-theme>`
  let out: string
  if (/<head[^>]*>/i.test(content)) {
    out = content.replace(/<head[^>]*>/i, head => `${head}${tag}`)
  } else if (/<html[^>]*>/i.test(content)) {
    out = content.replace(/<html[^>]*>/i, html => `${html}<head>${tag}</head>`)
  } else {
    out = tag + content
  }

  // Scope the generated token overrides to the viewer's active theme.
  if (themeId && isThemeId(themeId) && /<html\b/i.test(out) && !/data-serangkai-theme=/i.test(out)) {
    out = out.replace(/<html\b/i, match => `${match} data-serangkai-theme="${themeId}"`)
  }
  return out
}
