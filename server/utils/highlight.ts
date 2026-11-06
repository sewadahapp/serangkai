import { createHighlighter, type Highlighter } from 'shiki'

/** Languages pre-registered so common fences highlight without a cold load. */
export const COMMON_LANGS = [
  'bash', 'shell', 'sh', 'console',
  'js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript',
  'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'dotenv',
  'html', 'vue', 'svelte', 'css', 'scss', 'markdown', 'md',
  'sql', 'python', 'py', 'go', 'rust', 'rs', 'java', 'kotlin', 'swift', 'ruby', 'php',
  'dockerfile', 'nginx', 'diff', 'xml',
]

let highlighterPromise: Promise<Highlighter> | null = null

export function getHighlighter() {
  highlighterPromise ||= createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: COMMON_LANGS,
  })
  return highlighterPromise
}

/** Fence languages Shiki may still load lazily beyond the pre-registered set. */
const ALIASES: Record<string, string> = {
  sh: 'bash', shell: 'bash', console: 'bash', zsh: 'bash',
  yml: 'yaml', py: 'python', rs: 'rust', md: 'markdown',
  text: '', plaintext: '', txt: '',
}

export function normalizeLanguage(lang = '') {
  const raw = lang.trim().toLowerCase().split(/\s+/)[0] || ''
  if (raw in ALIASES) return ALIASES[raw]
  return raw
}

export function isSupportedLanguage(lang = '') {
  const normalized = normalizeLanguage(lang)
  return normalized === '' || COMMON_LANGS.includes(normalized)
}

/** Extracts the inner markup Shiki emits, dropping its own `<pre>` wrapper. */
export function stripShikiPre(html: string) {
  const match = html.match(/<pre[^>]*>([\s\S]*)<\/pre>/)
  return match ? match[1] : html
}

/**
 * Highlights code with Shiki using github-light / github-dark dual themes.
 * Returns `null` for unknown languages or on failure so callers can fall back
 * to escaped text instead of emitting broken markup.
 */
export async function highlightCode(code: string, language = ''): Promise<string | null> {
  const lang = normalizeLanguage(language)
  if (!lang) return null
  if (!COMMON_LANGS.includes(lang)) return null
  try {
    const highlighter = await getHighlighter()
    if (!highlighter.getLoadedLanguages().includes(lang)) {
      await highlighter.loadLanguage(lang as any)
    }
    return highlighter.codeToHtml(code, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    })
  } catch {
    return null
  }
}
