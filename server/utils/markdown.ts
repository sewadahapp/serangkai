import { createMarkdownParser, defineComarkPlugin } from 'comark'
import { textContent } from 'comark/utils'
import security from 'comark/plugins/security'
import shiki from 'comark/plugins/shiki'
import toc from 'comark/plugins/toc'
import githubLight from '@shikijs/themes/github-light'
import githubDark from '@shikijs/themes/github-dark'
import bash from '@shikijs/langs/bash'
import css from '@shikijs/langs/css'
import dockerfile from '@shikijs/langs/dockerfile'
import go from '@shikijs/langs/go'
import html from '@shikijs/langs/html'
import http from '@shikijs/langs/http'
import javascript from '@shikijs/langs/javascript'
import json from '@shikijs/langs/json'
import jsonc from '@shikijs/langs/jsonc'
import markdown from '@shikijs/langs/markdown'
import python from '@shikijs/langs/python'
import rust from '@shikijs/langs/rust'
import sql from '@shikijs/langs/sql'
import typescript from '@shikijs/langs/typescript'
import vue from '@shikijs/langs/vue'
import yaml from '@shikijs/langs/yaml'
import {
  artifactComponents,
  findComponent,
  normalizeComponentTag,
  type ComponentProp,
} from '../../shared/artifact-components'

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

const supportedTags = artifactComponents.map(component => component.tag)

const blockedTags = [
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base',
  'style', 'form', 'button', 'textarea', 'select', 'option', 'video', 'audio', 'source',
  'track', 'canvas', 'svg', 'math',
]

const shikiLanguages = [
  bash, css, dockerfile, go, html, http, javascript, json, jsonc, markdown,
  python, rust, sql, typescript, vue, yaml,
]

const securityPlugin = security({
  allowedTags: [...htmlTags, ...supportedTags],
  blockedTags,
  allowedProtocols: ['http', 'https', 'mailto'],
  allowDataImages: false,
  tagFallback: element => textContent(element),
})

const shikiPlugin = shiki({
  themes: { light: githubLight, dark: githubDark },
  languages: shikiLanguages,
  registerDefaultThemes: false,
})

const tocPlugin = toc({ depth: 3, searchDepth: 3 })

type ComarkNode = string | [string, Record<string, any>, ...any[]]

function isElement(node: ComarkNode): node is [string, Record<string, any>, ...any[]] {
  return Array.isArray(node)
}

function normalizeValue(prop: ComponentProp, value: unknown) {
  switch (prop.type) {
    case 'string':
      return typeof value === 'string' ? value : undefined
    case 'url':
      return typeof value === 'string' ? value : undefined
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
      if (value === false || typeof value === 'string') return value
      return undefined
    case 'array':
      return Array.isArray(value) && JSON.stringify(value).length <= 100_000 ? value : undefined
    case 'object':
      return value && typeof value === 'object' && !Array.isArray(value) && JSON.stringify(value).length <= 100_000
        ? value
        : undefined
    default:
      return undefined
  }
}

function sanitizeComponentProps(tag: string, props: Record<string, any>) {
  const component = findComponent(tag)
  if (!component) return null
  const clean: Record<string, any> = {}
  for (const [name, value] of Object.entries(props)) {
    if (name === '$' || name === 'class' || name === 'style' || name === 'ui' || name === 'as' || name === 'is') continue
    if (name.startsWith(':') || name.startsWith('@') || name.startsWith('v-') || name.startsWith('on')) continue
    const spec = component.props[name]
    if (!spec) continue
    const normalized = normalizeValue(spec, value)
    if (normalized !== undefined) clean[name] = normalized
  }
  return clean
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
  const color = ({ note: 'info', tip: 'success', warning: 'warning', danger: 'danger' } as Record<string, string>)[type] || 'info'
  const { type: _type, ...rest } = props
  return [normalizeComponentTag('alert'), { ...rest, color }, ...children]
}

function transformNode(node: ComarkNode): ComarkNode | null {
  if (!isElement(node)) return node
  let [tag, props, ...children] = node
  props = { ...props }
  delete props.$

  // GitHub alert blockquotes become Selaras alerts.
  if (tag === 'alert') return alertNode(node)

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
    return name ? ['template', { name }, ...children.map(transformNode).filter(Boolean) as any[]] : null
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
  if (tag !== 'h1' && tag !== 'h2' && tag !== 'h3' && tag !== 'h4' && tag !== 'h5' && tag !== 'h6') delete props.id
  for (const key of Object.keys(props)) {
    if (key.startsWith(':') || key.startsWith('@') || key.startsWith('v-') || key.startsWith('on')) delete props[key]
  }

  const normalizedChildren = children
    .map(child => transformNode(child as ComarkNode))
    .filter(Boolean) as any[]
  return [tag, props, ...normalizedChildren]
}

const artifactPlugin = defineComarkPlugin({
  name: 'serangkai-artifact',
  post({ tree }) {
    tree.nodes = tree.nodes
      .map(node => transformNode(node as ComarkNode))
      .filter(Boolean) as any[]
  },
})

let parserPromise: Promise<(source: string) => Promise<any>> | undefined

function getParser() {
  parserPromise ||= createMarkdownParser({
    plugins: [artifactPlugin, securityPlugin, shikiPlugin, tocPlugin],
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
  const first = Array.isArray(document.nodes[0]) ? document.nodes[0][0] : null

  return {
    body: document,
    toc: document.meta?.toc?.links || [],
    startsWithHeading: first === 'h1',
  }
}
