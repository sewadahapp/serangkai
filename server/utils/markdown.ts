import { parseMarkdown, nodeTextContent } from '@nuxtjs/mdc/runtime'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { unified } from 'unified'
import { highlightToHast } from './highlight'
import { normalizeLanguage } from './markdown-language'
import { buildTocTree, type TocLink } from '../../app/utils/markdown-toc'

/**
 * MDC-based Markdown rendering.
 *
 * The document is parsed into an MDC (hast) tree, transformed into a small,
 * fixed set of nodes, and sanitized before it ever reaches Vue. The reader
 * renders that tree with `MDCRenderer`, so Mermaid and TanStack Charts are real
 * Vue components instead of placeholder divs mounted by hand.
 *
 * Two rules keep this safe:
 *  - author template expressions and directive props are removed, so
 *    `MDCRenderer` never evaluates author-supplied code on the server;
 *  - only explicitly approved custom components survive sanitization.
 */

const MERMAID_TAG = 'serangkai-mermaid'
const CHART_TAG = 'serangkai-chart'

/** Selaras components authors may use in Markdown. */
export const approvedMarkdownComponents = new Set([
  's-alert',
  's-badge',
  's-callout',
  's-card',
  's-card-group',
  's-icon',
])

const schema = {
  ...defaultSchema,
  // Headings get ids from the MDC parser; keep them unprefixed so TOC links
  // resolve, but allow ids only where they are useful.
  clobberPrefix: '',
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'details',
    'summary',
    'kbd',
    'del',
    'ins',
    'div',
    'span',
    'button',
    MERMAID_TAG,
    CHART_TAG,
    ...approvedMarkdownComponents,
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className'],
    h1: [...(defaultSchema.attributes?.h1 || []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 || []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 || []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 || []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 || []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 || []), 'id'],
    a: [...(defaultSchema.attributes?.a || []), 'href', 'target', 'rel'],
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    pre: [
      ...(defaultSchema.attributes?.pre || []),
      'className',
      'style',
      'language',
      'code',
      'meta',
      'filename',
      'highlights',
    ],
    span: [...(defaultSchema.attributes?.span || []), 'className', 'style'],
    button: ['type', 'className', 'aria-label'],
    [MERMAID_TAG]: ['source'],
    [CHART_TAG]: ['definition'],
    's-alert': ['title', 'description', 'color', 'variant', 'icon'],
    's-badge': ['label', 'color', 'variant', 'size', 'icon'],
    's-callout': ['title', 'description', 'color', 'variant', 'icon'],
    's-card': ['title', 'description', 'color', 'variant', 'icon'],
    's-card-group': ['columns'],
    's-icon': ['name', 'className'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
  },
}

const sanitizer = unified().use(rehypeSanitize, schema)

type HastNode = {
  type: string
  tag?: string
  value?: string
  props?: Record<string, unknown>
  children?: HastNode[]
}

interface MarkdownResult {
  body: { type: 'root'; children: HastNode[] }
  toc: TocLink[]
  startsWithHeading: boolean
}

function classNameOf(node: HastNode) {
  const value = node.props?.className
  if (Array.isArray(value)) return value.join(' ')
  return typeof value === 'string' ? value : ''
}

function languageOf(node: HastNode) {
  const declared = node.props?.language
  if (typeof declared === 'string' && declared) return normalizeLanguage(declared)
  const match = /language-([\w-]+)/.exec(classNameOf(node))
  return normalizeLanguage(match?.[1] || '')
}

function textOf(node: HastNode): string {
  return nodeTextContent(node as any).trim()
}

/** MDC uses `tag`/`props`; rehype-sanitize expects `tagName`/`properties`. */
function toHast(node: HastNode): any {
  if (node.type === 'text') return { type: 'text', value: node.value || '' }
  if (node.type === 'element') {
    return {
      type: 'element',
      tagName: node.tag,
      properties: node.props || {},
      children: (node.children || []).map(toHast),
    }
  }
  return { type: node.type, children: (node.children || []).map(toHast) }
}

function fromHast(node: any): HastNode {
  if (node.type === 'text') return { type: 'text', value: node.value || '' }
  if (node.type === 'element') {
    return {
      type: 'element',
      tag: node.tagName,
      props: node.properties || {},
      children: (node.children || []).map(fromHast),
    }
  }
  return { type: node.type, children: (node.children || []).map(fromHast) }
}

function replaceNode(parent: HastNode, index: number, replacement: HastNode | HastNode[]) {
  const items = Array.isArray(replacement) ? replacement : [replacement]
  parent.children?.splice(index, 1, ...items)
}

function errorPre(message: string, source: string): HastNode {
  return {
    type: 'element',
    tag: 'pre',
    props: { className: ['serangkai-chart-error'] },
    children: [{ type: 'element', tag: 'code', props: {}, children: [{ type: 'text', value: `${message}\n\n${source}` }] }],
  }
}

function chartNode(source: string): HastNode | null {
  try {
    const parsed = JSON.parse(source)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return {
      type: 'element',
      tag: CHART_TAG,
      props: { definition: JSON.stringify(parsed) },
      children: [],
    }
  } catch {
    return null
  }
}

function mermaidNode(source: string): HastNode {
  return { type: 'element', tag: MERMAID_TAG, props: { source }, children: [] }
}

/**
 * Turns fences and MDC components into the two interactive nodes and
 * highlights ordinary code fences. Runs before sanitization so the resulting
 * nodes can be validated like any other element.
 */
async function transform(root: HastNode) {
  const visit = async (node: HastNode) => {
    if (!node.children?.length) return
    for (let index = node.children.length - 1; index >= 0; index--) {
      const child = node.children[index]
      if (!child) continue

      // Remove author-supplied expressions instead of letting MDCRenderer
      // evaluate them. The literal text is preserved so content is not lost.
      if (child.type === 'element' && child.tag === 'binding') {
        const value = typeof child.props?.value === 'string' ? child.props.value : ''
        replaceNode(node, index, { type: 'text', value: `{{ ${value} }}` })
        continue
      }

      if (child.type === 'element' && child.tag === 'pre') {
        const language = languageOf(child)
        const source = textOf(child)

        if (language === 'mermaid') {
          replaceNode(node, index, mermaidNode(source))
          continue
        }
        if (language === 'chart' || language === 'chartjson') {
          replaceNode(node, index, chartNode(source) || errorPre('This chart is not valid JSON.', source))
          continue
        }

        const highlighted = source
          ? await highlightToHast(source, language)
          : null
        if (highlighted) {
          child.props = { ...child.props, ...highlighted.props }
          child.children = highlighted.children
        }
      }

      // MDC container syntax: ::mermaid / ::chart
      if (child.type === 'element' && (child.tag === 'mermaid' || child.tag === 'chart')) {
        const source = textOf(child)
        if (child.tag === 'mermaid') {
          replaceNode(node, index, mermaidNode(source))
        } else {
          replaceNode(node, index, chartNode(source) || errorPre('This chart is not valid JSON.', source))
        }
        continue
      }

      await visit(child)
    }
  }
  await visit(root)
}

/** Drops directive/expression props, author styles, and unknown components. */
function neutralize(root: HastNode) {
  const visit = (node: HastNode) => {
    if (node.type === 'element') {
      const props = node.props || {}
      for (const key of Object.keys(props)) {
        if (key.startsWith('v-') || key.startsWith(':') || key.startsWith('@') || key.startsWith('#')) {
          delete props[key]
        }
      }
      // Author styles can overlay or spoof the app chrome. Shiki styles are
      // added after this pass, so they are unaffected.
      delete props.style
      if (!['pre', 'code', 'span'].includes(node.tag || '')) delete props.className
      node.props = props

      if (node.tag && node.tag.includes('-') && !approvedMarkdownComponents.has(node.tag) && node.tag !== MERMAID_TAG && node.tag !== CHART_TAG) {
        // Unknown components become plain blocks; their children stay visible.
        node.tag = 'div'
      }
    }
    for (const child of node.children || []) visit(child)
  }
  visit(root)
}

/**
 * Renders Markdown into a sanitized MDC body plus a nested TOC.
 *
 * The body is JSON-serializable, so the Nuxt SSR payload carries it to the
 * client where `MDCRenderer` mounts the approved components.
 */
export async function renderMarkdownContent(source: string): Promise<MarkdownResult> {
  const parsed = await parseMarkdown(source.replace(/\r\n/g, '\n'), {
    highlight: false,
    contentHeading: false,
    toc: { searchDepth: 2, depth: 3 },
  })

  const body = parsed.body as unknown as HastNode
  neutralize(body)
  await transform(body)

  const sanitized = fromHast(await sanitizer.run(toHast(body))) as HastNode
  const first = sanitized.children?.find(child => child.type === 'element')

  return {
    body: sanitized as MarkdownResult['body'],
    toc: buildTocTree((parsed.toc?.links || []) as TocLink[]),
    startsWithHeading: first?.tag === 'h1',
  }
}
