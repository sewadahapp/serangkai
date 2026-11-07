import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMarkdownContent } from '../server/utils/markdown.ts'
import { isSupportedLanguage } from '../server/utils/highlight.ts'
import { normalizeLanguage } from '../server/utils/markdown-language.ts'

function find(node, predicate) {
  if (predicate(node)) return node
  for (const child of node.children || []) {
    const match = find(child, predicate)
    if (match) return match
  }
  return null
}

function findAll(node, predicate, found = []) {
  if (predicate(node)) found.push(node)
  for (const child of node.children || []) findAll(child, predicate, found)
  return found
}

test('renders Mermaid fences as component nodes', async () => {
  const { body } = await renderMarkdownContent('```mermaid\ngraph TD\n  A --> B\n```')
  const node = find(body, item => item.tag === 'serangkai-mermaid')
  assert.ok(node, 'expected a mermaid node')
  assert.match(node.props.source, /graph TD/)
  // The raw source is data, not markup.
  assert.equal(node.children.length, 0)
})

test('renders valid chart JSON as a chart node', async () => {
  const { body } = await renderMarkdownContent('```chart\n{"type":"bar","xKey":"month","yKey":"value","data":[{"month":"Jan","value":10}]}\n```')
  const node = find(body, item => item.tag === 'serangkai-chart')
  assert.ok(node, 'expected a chart node')
  assert.equal(JSON.parse(node.props.definition).type, 'bar')
})

test('renders MDC container syntax for diagrams and charts', async () => {
  const { body } = await renderMarkdownContent('::mermaid\nflowchart LR\n  A --> B\n::\n\n::chart\n{"type":"line","data":[{"x":"a","y":1}]}\n::\n')
  assert.ok(find(body, item => item.tag === 'serangkai-mermaid'))
  assert.ok(find(body, item => item.tag === 'serangkai-chart'))
})

test('keeps invalid chart JSON visible without executable HTML', async () => {
  const { body } = await renderMarkdownContent('```chart\nnot json\n```')
  assert.ok(find(body, item => item.tag === 'pre' && String(item.props.className || '').includes('serangkai-chart-error')))
  assert.equal(find(body, item => item.tag === 'script'), null)
})

test('highlights fenced code with Shiki and keeps the copy source', async () => {
  const { body } = await renderMarkdownContent('```ts\nconst x: number = 1\n```')
  const pre = find(body, item => item.tag === 'pre')
  assert.ok(pre)
  assert.equal(pre.props.language, 'ts')
  assert.equal(pre.props.code, 'const x: number = 1\n')
  assert.match(JSON.stringify(pre), /--shiki-light:/)
  assert.match(JSON.stringify(pre), /--shiki-dark:/)
  // exactly one code element, not doubled
  assert.equal(findAll(pre, item => item.tag === 'code').length, 1)
})

test('falls back to escaped text for unknown languages and never emits markup', async () => {
  const { body } = await renderMarkdownContent('```notalanguage\n<b>raw</b> & text\n```')
  const serialized = JSON.stringify(body)
  assert.match(serialized, /<b>raw<\/b> & text/)
  assert.doesNotMatch(serialized, /--shiki-light/)
  // The raw fence is text inside code, not live elements.
  const pre = find(body, item => item.tag === 'pre')
  assert.ok(pre)
  assert.equal(findAll(pre, item => item.tag === 'b').length, 0)
})

test('highlighting never emits executable markup', async () => {
  const { body } = await renderMarkdownContent('```html\n<script>alert(1)</script>\n```')
  assert.equal(find(body, item => item.tag === 'script'), null)
  const serialized = JSON.stringify(body)
  assert.match(serialized, /alert/)
  assert.doesNotMatch(serialized, /onerror=/i)
  assert.doesNotMatch(serialized, /javascript:/i)
})

test('mermaid and chart fences are not syntax highlighted', async () => {
  const mermaid = await renderMarkdownContent('```mermaid\ngraph TD\n A-->B\n```')
  assert.doesNotMatch(JSON.stringify(mermaid.body), /--shiki-light/)
  const chart = await renderMarkdownContent('```chart\n{"type":"bar"}\n```')
  assert.doesNotMatch(JSON.stringify(chart.body), /--shiki-light/)
})

test('normalizes common language aliases', () => {
  assert.equal(normalizeLanguage('sh'), 'bash')
  assert.equal(normalizeLanguage('yml'), 'yaml')
  assert.equal(normalizeLanguage('py'), 'python')
  assert.equal(normalizeLanguage('TS'), 'ts')
  assert.equal(normalizeLanguage(''), '')
})

test('supports raw HTTP request snippets', async () => {
  assert.ok(isSupportedLanguage('http'))
  const { body } = await renderMarkdownContent('```http\nPOST /api/artifacts\nAuthorization: Bearer <token>\n```')
  assert.match(JSON.stringify(body), /--shiki-light:/)
  assert.match(JSON.stringify(body), /\/api\/artifacts/)
  assert.equal(find(body, item => item.tag === 'script'), null)
})

test('gives headings stable, unique ids for anchors and the table of contents', async () => {
  const { body, toc, startsWithHeading } = await renderMarkdownContent('# Top\n\n## Setup\n\n### Setup\n\n## Setup\n')
  const ids = findAll(body, item => /^h[1-6]$/.test(item.tag || '')).map(item => item.props.id)
  assert.deepEqual(ids, ['top', 'setup', 'setup-1', 'setup-2'])
  assert.equal(startsWithHeading, true)
  assert.deepEqual(toc.map(link => link.id), ['setup', 'setup-2'])
  assert.deepEqual(toc[0].children?.map(link => link.id), ['setup-1'])
})

test('strips author scripts, iframes, event handlers, and javascript: URLs', async () => {
  const { body } = await renderMarkdownContent([
    '<script>alert(1)</script>',
    '<iframe src="https://evil.example"></iframe>',
    '<span onclick="alert(1)" style="position:fixed">x</span>',
    '[bad](javascript:alert(1))',
    '<img src=x onerror=alert(1)>',
  ].join('\n\n'))

  const tags = findAll(body, item => item.type === 'element').map(item => item.tag)
  assert.ok(!tags.includes('script'))
  assert.ok(!tags.includes('iframe'))
  const serialized = JSON.stringify(body)
  assert.doesNotMatch(serialized, /onerror|onclick/i)
  assert.doesNotMatch(serialized, /javascript:/i)
  assert.doesNotMatch(serialized, /position:fixed/)
  assert.doesNotMatch(serialized, /evil\.example/)
})

test('never lets MDC expressions or unknown components execute', async () => {
  const { body } = await renderMarkdownContent([
    'Inline {{ $doc.secret }} value.',
    '::evil-widget{onClick="alert(1)"}',
    'Payload',
    '::',
    '::s-badge{label="Approved" color="success"}',
    '::',
  ].join('\n'))

  const serialized = JSON.stringify(body)
  assert.doesNotMatch(serialized, /v-on|onclick|v-bind/i)
  assert.equal(find(body, item => item.tag === 'evil-widget'), null)
  assert.ok(find(body, item => item.tag === 's-badge'))
  // The expression is preserved as literal text, never evaluated.
  assert.match(serialized, /\{\{ \$doc\.secret \}\}/)
})

test('keeps approved Selaras components with their attributes', async () => {
  const { body } = await renderMarkdownContent('::s-alert{title="Heads up" color="warning"}\nRead this.\n::\n')
  const alert = find(body, item => item.tag === 's-alert')
  assert.ok(alert)
  assert.equal(alert.props.title, 'Heads up')
  assert.equal(alert.props.color, 'warning')
})
