import { createHighlighter, bundledLanguages, type Highlighter } from 'shiki'
import { normalizeLanguage } from './markdown-language'

/** Languages pre-registered so common fences highlight without a cold load. */
export const COMMON_LANGS = [
  'bash', 'shell', 'sh', 'console',
  'js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript',
  'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'dotenv',
  'html', 'vue', 'svelte', 'css', 'scss', 'markdown', 'md',
  'sql', 'python', 'py', 'go', 'rust', 'rs', 'java', 'kotlin', 'swift', 'ruby', 'php',
  'dockerfile', 'nginx', 'diff', 'xml', 'http',
]

let highlighterPromise: Promise<Highlighter> | null = null

export function getHighlighter() {
  highlighterPromise ||= createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: COMMON_LANGS,
  })
  return highlighterPromise
}

export function isSupportedLanguage(lang = '') {
  const normalized = normalizeLanguage(lang)
  return normalized === '' || normalized in bundledLanguages
}

interface HighlightedFence {
  type: 'element'
  tag: 'pre'
  props: Record<string, unknown>
  children: any[]
}

function toMdcNode(node: any): any {
  if (node.type === 'text') return { type: 'text', value: node.value || '' }
  if (node.type === 'element') {
    return {
      type: 'element',
      tag: node.tagName,
      props: node.properties || {},
      children: (node.children || []).map(toMdcNode),
    }
  }
  return { type: node.type, children: (node.children || []).map(toMdcNode) }
}

/**
 * Highlights a fence and returns a `pre` node ready for the MDC tree.
 *
 * Returns `null` for unknown languages or on failure, so callers keep the
 * escaped source instead of emitting broken markup.
 */
export async function highlightToHast(code: string, language = ''): Promise<HighlightedFence | null> {
  const lang = normalizeLanguage(language)
  if (!lang) return null

  try {
    const highlighter = await getHighlighter()
    if (!highlighter.getLoadedLanguages().includes(lang)) {
      const bundled = bundledLanguages[lang as keyof typeof bundledLanguages]
      if (!bundled) return null
      await highlighter.loadLanguage(bundled as any)
    }

    const hast = highlighter.codeToHast(code, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    })

    const pre = hast.children[0]
    if (pre?.type !== 'element' || pre.tagName !== 'pre') return null
    return {
      type: 'element',
      tag: 'pre',
      props: pre.properties || {},
      children: (pre.children || []).map(toMdcNode),
    }
  } catch {
    return null
  }
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
  if (!(lang in bundledLanguages)) return null
  try {
    const highlighter = await getHighlighter()
    if (!highlighter.getLoadedLanguages().includes(lang)) {
      await highlighter.loadLanguage(bundledLanguages[lang as keyof typeof bundledLanguages] as any)
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

/** Resolves the language label shown in the code header. */
export function displayLanguage(lang = '') {
  return normalizeLanguage(lang) || 'text'
}
