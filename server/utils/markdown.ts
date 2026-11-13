import { createMarkdownParser, defineComarkPlugin } from 'comark'
import { textContent } from 'comark/utils'
import security from 'comark/plugins/security'
import shiki from 'comark/plugins/shiki'
import toc from 'comark/plugins/toc'
import { SHIKI_LANGUAGES, SHIKI_THEMES } from './shiki'
import {
  rangkaComponents,
  findComponent,
  normalizeComponentTag,
  type ComponentProp,
} from '../../shared/rangka-components'

/**
 * Comark-based Markdown rendering.
 *
 * Parsing happens once on the server. The resulting serializable document is
 * sanitized, transformed into a small trusted vocabulary, and rendered by
 * `MarkdownDocument` on the client/SSR without shipping the parser.
 *
 * Security boundary:
 *  - author expressions, binding props, event handlers, styles, unknown
 *    components, scripts, iframes, and unsafe protocols are removed before the
 *    renderer sees the document;
 *  - only the declarative component registry is exposed;
 *  - Shiki styles are added after author styles are stripped.
 */

const htmlTags = [
  'a', 'p', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'small', 'sub', 'sup',
  'kbd', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'img', 'figure', 'figcaption', 'div', 'span', 'details', 'summary', 'template', 'input',
]

const supportedTags = rangkaComponents.map(component => component.tag)

const blockedTags = [
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base',
  'style', 'form', 'button', 'textarea', 'select', 'option', 'video', 'audio', 'source',
  'track', 'canvas', 'svg', 'math',
]

const shikiPlugin = shiki({
  themes: SHIKI_THEMES,
  languages: SHIKI_LANGUAGES,
  registerDefaultThemes: false,
})

const securityPlugin = security({
  allowedTags: [...htmlTags, ...supportedTags],
  blockedTags,
  allowedProtocols: ['http', 'https', 'mailto'],
  allowDataImages: false,
  tagFallback: element => textContent(element),
})

const tocPlugin = toc({ depth: 3, searchDepth: 3 })

type ComarkNode = string | [string, Record<string, any>, ...any[]]

function isElement(node: ComarkNode): node is [string, Record<string, any>, ...any[]] {
  return Array.isArray(node)
}

/**
 * Keys that must never survive inside declarative component data.
 *
 * Selaras renders some nested item objects (timeline, tree, ...) by spreading
 * them onto DOM elements (`v-bind="itemUi(...)"`, `:class="item.class"`).
 * A `style`/`class`/`ui` key in author JSON therefore becomes live CSS in the
 * application origin.
 */
const blockedDataKeys = new Set([
  'class', 'classname', 'style', 'ui', 'as', 'is',
  '__proto__', 'constructor', 'prototype', 'innerhtml', 'outerhtml', 'srcdoc', 'textcontent',
])

/**
 * Real DOM event handler attribute names.
 *
 * A blanket `startsWith('on')` filter also deletes legitimate data columns
 * such as `owner`, `onboarding`, or `online`. Components only spread the
 * (already-blocked) `ui`/`class` members onto elements, so matching the actual
 * DOM event names keeps the boundary without corrupting author data.
 */
const domEventAttributes = new Set([
  'onabort', 'onafterprint', 'onauxclick', 'onbeforeinput', 'onbeforeprint', 'onbeforeunload',
  'onblur', 'oncancel', 'oncanplay', 'oncanplaythrough', 'onchange', 'onclick', 'onclose',
  'oncontextmenu', 'oncopy', 'oncut', 'ondblclick', 'ondrag', 'ondragend', 'ondragenter',
  'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'ondurationchange', 'onemptied',
  'onended', 'onerror', 'onfocus', 'onformdata', 'onhashchange', 'oninput', 'oninvalid',
  'onkeydown', 'onkeypress', 'onkeyup', 'onlanguagechange', 'onload', 'onloadeddata',
  'onloadedmetadata', 'onloadstart', 'onmessage', 'onmessageerror', 'onmousedown',
  'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup',
  'onoffline', 'ononline', 'onpagehide', 'onpageshow', 'onpaste', 'onpause', 'onplay',
  'onplaying', 'onpopstate', 'onprogress', 'onratechange', 'onrejectionhandled', 'onreset',
  'onresize', 'onscroll', 'onscrollend', 'onsecuritypolicyviolation', 'onseeked', 'onseeking',
  'onselect', 'onslotchange', 'onstalled', 'onstorage', 'onsubmit', 'onsuspend',
  'ontimeupdate', 'ontoggle', 'onunhandledrejection', 'onunload', 'onvolumechange',
  'onwaiting', 'onwheel', 'onanimationstart', 'onanimationend', 'onanimationiteration',
  'ontransitionend', 'onpointerdown', 'onpointerup', 'onpointermove', 'onpointerenter',
  'onpointerleave', 'onpointercancel', 'ontouchstart', 'ontouchend', 'ontouchmove',
  'ontouchcancel', 'ongotpointercapture', 'onlostpointercapture',
])

const urlPropNames = new Set([
  'to', 'href', 'src', 'srcset', 'url', 'uri', 'link', 'links', 'action', 'poster', 'cite', 'background', 'ping', 'formaction',
])

const safeUrlProtocols = new Set(['http:', 'https:', 'mailto:'])

function normalizePropKey(name: string) {
  return name.replace(/-([a-z0-9])/g, (_match, character: string) => character.toUpperCase())
}

function safeUrl(value: string) {
  // Relative URLs and fragments stay local; absolute URLs must use a known
  // safe scheme. `javascript:`, `vbscript:`, and `data:` are rejected.
  const trimmed = value.trim()
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return value
  try {
    return safeUrlProtocols.has(new URL(trimmed).protocol) ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Recursively sanitizes author JSON handed to a Selaras component.
 *
 * Top-level props are validated against the registry; this pass protects the
 * nested arrays/objects that several components spread onto DOM nodes.
 */
function sanitizeDataValue(
  value: unknown,
  depth = 0,
  budget = { nodes: 0, bytes: 0 },
): unknown {
  if (depth > 12) return undefined
  if (typeof value === 'string') {
    budget.bytes += value.length
    return budget.bytes > 100_000 ? undefined : value
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) {
    const result = []
    for (const item of value) {
      if (++budget.nodes > 2_000) return undefined
      const clean = sanitizeDataValue(item, depth + 1, budget)
      if (clean !== undefined) result.push(clean)
    }
    return result
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      if (++budget.nodes > 2_000) return undefined
      const lower = key.toLowerCase()
      if (blockedDataKeys.has(lower) || domEventAttributes.has(lower) || lower.startsWith('v-')) continue
      const clean = sanitizeDataValue(child, depth + 1, budget)
      if (clean === undefined) continue
      if (typeof clean === 'string' && urlPropNames.has(key.toLowerCase())) {
        const url = safeUrl(clean)
        if (url === undefined) continue
        result[key] = url
        continue
      }
      if (typeof clean === 'string' && lower === 'icon' && !clean.startsWith('lucide:')) continue
      result[key] = clean
    }
    return result
  }
  return undefined
}

function normalizeValue(prop: ComponentProp, value: unknown) {
  switch (prop.type) {
    case 'string':
      return typeof value === 'string' ? value : undefined
    case 'url':
      return typeof value === 'string' ? safeUrl(value) : undefined
    case 'number': {
      const number = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(number) ? number : undefined
    }
    case 'boolean':
      if (typeof value === 'boolean') return value
      if (value === 'true') return true
      if (value === 'false') return false
      return undefined
    case 'color':
      return typeof value === 'string' ? value : undefined
    case 'icon':
      return typeof value === 'string' && value.startsWith('lucide:') ? value : undefined
    case 'enum':
      return typeof value === 'string' && prop.values.includes(value) ? value : undefined
    case 'stringOrArray':
      if (typeof value === 'string') return value
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value
      return undefined
    case 'stringOrFalse':
      if (value === false) return false
      // The registry documents this as an icon slot: only the locally bundled
      // Lucide collection may be requested.
      if (typeof value === 'string' && value.startsWith('lucide:')) return value
      return undefined
    case 'array':
      return Array.isArray(value) ? sanitizeDataValue(value) : undefined
    case 'object': {
      const clean = sanitizeDataValue(value)
      return clean && typeof clean === 'object' && !Array.isArray(clean) ? clean : undefined
    }
    default:
      return undefined
  }
}

function sanitizeComponentProps(tag: string, props: Record<string, any>) {
  const component = findComponent(tag)
  if (!component) return null
  const clean: Record<string, any> = {}
  for (const [name, rawValue] of Object.entries(props)) {
    if (name === '$' || name === 'class' || name === 'style' || name === 'ui' || name === 'as' || name === 'is') continue
    if (name.startsWith('@') || name.startsWith('v-') || name.startsWith('on')) continue

    // Comark turns a bare attribute into a `:name` binding (`striped` ->
    // `":striped": "true"`). Treat bindings as their literal JSON value, but
    // only for registry props, so evaluation never reaches author input.
    const isBinding = name.startsWith(':') || name.startsWith('v-bind:')
    const propName = isBinding ? name.replace(/^(?::|v-bind:)/, '') : name
    const spec = component.props[propName] || component.props[normalizePropKey(propName)]
    if (!spec) continue

    let value: unknown = rawValue
    if (isBinding && typeof rawValue === 'string') {
      try { value = JSON.parse(rawValue) } catch { value = rawValue }
    }

    const normalized = normalizeValue(spec, value)
    if (normalized === undefined) continue
    const key = normalizePropKey(propName)

    // Structured values are serialized until after Comark's security pass.
    // That plugin re-validates nested object keys and deletes any key starting
    // with "on" (it treats them as event handlers), which silently corrupts
    // legitimate data such as `{ "onboarding": true }`. Passing a JSON string
    // keeps the payload opaque to that pass; `restoreStructuredProps` parses it
    // back once the tree is trusted.
    if (spec.type === 'array' || spec.type === 'object') clean[key] = JSON.stringify(normalized)
    else if (spec.type === 'stringOrArray' && Array.isArray(normalized)) clean[key] = JSON.stringify(normalized)
    else clean[key] = normalized
  }
  return clean
}

/** Rehydrates structured props serialized for the Comark security pass. */
function restoreStructuredProps(nodes: any[]) {
  for (const node of nodes) {
    if (!Array.isArray(node)) continue
    const [tag, props, ...children] = node
    const component = findComponent(tag)
    if (component && props) {
      for (const [name, value] of Object.entries(props)) {
        const spec = component.props[name]
        if (!spec || typeof value !== 'string') continue
        const structured = spec.type === 'array' || spec.type === 'object'
          || (spec.type === 'stringOrArray' && value.startsWith('['))
        if (!structured) continue
        try {
          const parsed = JSON.parse(value)
          if (spec.type === 'array') { if (Array.isArray(parsed)) props[name] = parsed }
          else if (spec.type === 'object') { if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) props[name] = parsed }
          else props[name] = parsed
        } catch {}
      }
    }
    restoreStructuredProps(children)
  }
}

function slotName(props: Record<string, any>) {
  return typeof props.name === 'string'
    ? props.name
    : typeof props['v-slot'] === 'string'
      ? props['v-slot']
      : ''
}

function normalizeLegacyChartBlocks(source: string) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const output: string[] = []
  let inFence = false

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] || ''
    if (line.trimStart().startsWith('```')) inFence = !inFence
    if (inFence || line.trim() !== '::chart') {
      output.push(line)
      continue
    }

    const body: string[] = []
    let cursor = index + 1
    while (cursor < lines.length && (lines[cursor] || '').trim() !== '::') {
      body.push(lines[cursor] || '')
      cursor++
    }
    if (cursor >= lines.length) {
      output.push(line)
      continue
    }

    const trimmed = body.join('\n').trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      output.push('```chart', trimmed, '```')
      index = cursor
    } else {
      output.push(line)
    }
  }

  return output.join('\n')
}

function chartNode(source: string): ComarkNode {
  try {
    const parsed = JSON.parse(source)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    return ['serangkai-chart', { definition: JSON.stringify(parsed) }]
  } catch {
    return ['div', { class: 'serangkai-chart-error' }, 'This chart is not valid JSON.', ['pre', {}, source]]
  }
}

function mermaidNode(source: string): ComarkNode {
  return ['serangkai-mermaid', { source }]
}

function alertNode(node: [string, Record<string, any>, ...any[]]): ComarkNode {
  const [, props, ...children] = node
  const type = props.type
  const color = ({ note: 'info', tip: 'success', important: 'accent', warning: 'warning', caution: 'danger', danger: 'danger' } as Record<string, string>)[type] || 'info'
  const { type: _type, ...rest } = props
  const clean = sanitizeComponentProps('s-alert', { ...rest, color })
  return ['s-alert', clean || { color }, ...children.map(transformNode).filter(Boolean) as any[]]
}

/** Converts a GitHub alert blockquote (`> [!NOTE]`) to a Selaras callout. */
function githubAlertNode(node: [string, Record<string, any>, ...any[]]): ComarkNode {
  const [, props, ...children] = node
  const marker = String(props.as)
  const type = ({ note: 'note', tip: 'tip', important: 'note', warning: 'warning', caution: 'danger' } as Record<string, string>)[marker] || 'note'
  const clean = sanitizeComponentProps('s-callout', { type })
  return ['s-callout', clean || { type }, ...children.map(transformNode).filter(Boolean) as any[]]
}

function transformNode(node: ComarkNode): ComarkNode | null {
  if (!isElement(node)) return node
  let [tag, props, ...children] = node
  props = { ...props }
  delete props.$

  // GitHub alert blockquotes become Selaras alerts. Comark's alert plugin
  // marks them with `as="note|tip|important|warning|caution"`, which the
  // security plugin would otherwise strip because it is not an allowed tag.
  if (tag === 'alert') return alertNode(node)
  if (tag === 'blockquote' && props.as) return githubAlertNode(node)

  // Declarative chart/diagram components.
  if (tag === 'mermaid') return mermaidNode(textContent(node))
  if (tag === 'chart') return chartNode(textContent(node))

  if (tag === 'pre') {
    const language = String(props.language || '').toLowerCase()
    const source = textContent(node)
    if (language === 'mermaid') return mermaidNode(source)
    if (language === 'chart' || language === 'chartjson') return chartNode(source)
  }

  // Raw input is only allowed for GFM task-list checkboxes.
  if (tag === 'input') {
    if (props.type !== 'checkbox') return null
    return ['input', { type: 'checkbox', checked: props.checked === true || props.checked === 'true', disabled: true }]
  }

  if (tag === 'template') {
    const name = slotName(props)
    const safe = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
    return safe ? ['template', { name: safe }, ...children.map(transformNode).filter(Boolean) as any[]] : null
  }

  const canonical = normalizeComponentTag(tag)
  const component = findComponent(canonical)
  if (component) {
    const clean = sanitizeComponentProps(canonical, props)
    const normalizedChildren = children
      .map(child => transformNode(child as ComarkNode))
      .filter(Boolean) as any[]
    return [canonical, clean || {}, ...normalizedChildren]
  }

  // Author styles and classes would leak into the app shell. Shiki adds its
  // own styles later, after this pass.
  delete props.style
  delete props.class
  delete props.className
  // `as`/`is` turn any native element into a dynamic Vue component with raw,
  // unvalidated props (`<div as="s-button" to="...">`). The registry is the
  // only way to reach a Selaras component, so drop the escape hatch and the
  // Selaras `ui` override along with it.
  delete props.as
  delete props.is
  delete props.ui
  if (tag !== 'h1' && tag !== 'h2' && tag !== 'h3' && tag !== 'h4' && tag !== 'h5' && tag !== 'h6') delete props.id
  for (const key of Object.keys(props)) {
    if (key.startsWith(':') || key.startsWith('@') || key.startsWith('v-') || key.startsWith('on')) delete props[key]
  }

  const normalizedChildren = children
    .map(child => transformNode(child as ComarkNode))
    .filter(Boolean) as any[]
  return [tag, props, ...normalizedChildren]
}

const rangkaPlugin = defineComarkPlugin({
  name: 'serangkai-rangka',
  post({ tree }) {
    tree.nodes = tree.nodes
      .map(node => transformNode(node as ComarkNode))
      .filter(Boolean) as any[]
  },
})

let parserPromise: Promise<(source: string) => Promise<any>> | undefined

function getParser() {
  parserPromise ||= createMarkdownParser({
    plugins: [rangkaPlugin, securityPlugin, shikiPlugin, tocPlugin],
    autoClose: false,
    headingIds: 'flat',
  })
  return parserPromise
}

export interface RenderedMarkdown {
  body: Record<string, any>
  toc: any[]
  startsWithHeading: boolean
}

export async function renderMarkdownContent(source: string): Promise<RenderedMarkdown> {
  const parser = await getParser()
  const document = await parser(normalizeLegacyChartBlocks(source))
  // Comark's security plugin has now run. Restore the structured props it
  // cannot see safely as objects without dropping legitimate `on*` data keys.
  restoreStructuredProps(document.nodes)
  const first = Array.isArray(document.nodes[0]) ? document.nodes[0][0] : null

  return {
    body: document,
    toc: document.meta?.toc?.links || [],
    startsWithHeading: first === 'h1',
  }
}
