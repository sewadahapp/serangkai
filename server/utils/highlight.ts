import { getHighlighterCore } from './shiki'
import { normalizeLanguage } from './markdown-language'

/**
 * Highlights code with Shiki using github-light / github-dark dual themes.
 * Returns `null` for unknown languages or on failure so callers can fall back
 * to escaped text instead of emitting broken markup.
 *
 * Uses the shared core highlighter (JavaScript regex engine) — the full
 * `shiki` bundle's Oniguruma WASM does not run on Cloudflare Workers.
 */
export async function highlightCode(code: string, language = ''): Promise<string | null> {
  const lang = normalizeLanguage(language)
  if (!lang) return null
  try {
    const highlighter = await getHighlighterCore()
    return highlighter.codeToHtml(code, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    })
  } catch {
    return null
  }
}

/** Extracts the inner markup Shiki emits, dropping its own `<pre>` wrapper. */
export function stripShikiPre(html: string) {
  const match = html.match(/<pre[^>]*>([\s\S]*)<\/pre>/)
  return match ? match[1] : html
}