import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMarkdownContent } from '../server/utils/markdown.ts'

function isElement(node) {
  return Array.isArray(node) && typeof node[0] === 'string'
}

function walkNode(node, predicate, found) {
  if (isElement(node)) {
    if (predicate(node)) found.push(node)
    for (const child of node.slice(2)) walkNode(child, predicate, found)
  }
}

function findAll(nodes, predicate) {
  const found = []
  for (const node of nodes) walkNode(node, predicate, found)
  return found
}

function find(nodes, predicate) {
  return findAll(nodes, predicate)[0] || null
}

function tags(document) {
  return findAll(document.nodes, () => true).map(node => node[0])
}

test('renders ordinary Markdown, tables, links, and headings', async () => {
  const { body, toc, startsWithHeading } = await renderMarkdownContent([
    '# Title',
    '',
    '## Overview',
    '',
    'A **bold** paragraph with a [link](/workspace).',
    '',
    '| Name | Role |',
    '| --- | --- |',
    '| Ada | Admin |',
  ].join('\n'))

  assert.equal(startsWithHeading, true)
  assert.ok(find(body.nodes, node => node[0] === 'h1' && node[1].id === 'title'))
  assert.ok(find(body.nodes, node => node[0] === 'strong'))
  assert.ok(find(body.nodes, node => node[0] === 'a' && node[1].href === '/workspace'))
  assert.ok(find(body.nodes, node => node[0] === 'table'))
  assert.deepEqual(toc.map(link => link.id), ['overview'])
})

test('renders Mermaid and chart fences as trusted component nodes', async () => {
  const { body } = await renderMarkdownContent([
    '```mermaid',
    'flowchart LR',
    '  A --> B',
    '```',
    '',
    '```chart',
    '{"type":"bar","data":[{"week":"W1","value":1}],"x":"week","y":"value"}',
    '```',
  ].join('\n'))

  const mermaid = find(body.nodes, node => node[0] === 'serangkai-mermaid')
  const chart = find(body.nodes, node => node[0] === 'serangkai-chart')
  assert.match(mermaid[1].source, /flowchart LR/)
  assert.equal(JSON.parse(chart[1].definition).type, 'bar')
})

test('keeps legacy Comark chart and Mermaid component syntax working', async () => {
  const { body } = await renderMarkdownContent([
    '::mermaid',
    'flowchart TD',
    '  X --> Y',
    '::',
    '',
    '::chart',
    '{"type":"line","data":[{"x":"a","y":1}]}',
    '::',
  ].join('\n'))

  assert.ok(find(body.nodes, node => node[0] === 'serangkai-mermaid'))
  assert.ok(find(body.nodes, node => node[0] === 'serangkai-chart'))
})

test('keeps invalid chart JSON visible without executable HTML', async () => {
  const { body } = await renderMarkdownContent('```chart\nnot json\n```')
  assert.ok(find(body.nodes, node => node[0] === 'div' && node[1].class === 'serangkai-chart-error'))
  assert.equal(find(body.nodes, node => node[0] === 'script'), null)
})

test('highlights code with Shiki dual themes and keeps the TOC heading ids', async () => {
  const { body } = await renderMarkdownContent('## Setup\n\n```ts\nconst x: number = 1\n```')
  const pre = find(body.nodes, node => node[0] === 'pre')
  assert.equal(pre[1].language, 'ts')
  assert.match(pre[1].class, /shiki/)
  assert.match(JSON.stringify(pre), /--shiki-dark:/)
  assert.ok(find(body.nodes, node => node[0] === 'h2' && node[1].id === 'setup'))
})

test('sanitizes scripts, iframes, styles, event handlers, and javascript URLs', async () => {
  const { body } = await renderMarkdownContent([
    '<script>alert(1)</script>',
    '<iframe src="https://evil.example"></iframe>',
    '<span onclick="alert(1)" style="position:fixed">x</span>',
    '[bad](javascript:alert(1))',
    '<img src=x onerror=alert(1)>',
  ].join('\n\n'))

  const allTags = tags(body)
  assert.ok(!allTags.includes('script'))
  assert.ok(!allTags.includes('iframe'))
  const serialized = JSON.stringify(body)
  assert.doesNotMatch(serialized, /onerror|onclick/i)
  assert.doesNotMatch(serialized, /position:fixed/)
  assert.doesNotMatch(serialized, /evil\.example/)
  const links = findAll(body.nodes, node => node[0] === 'a')
  assert.ok(links.every(link => !String(link[1].href || '').toLowerCase().startsWith('javascript:')))
  const images = findAll(body.nodes, node => node[0] === 'img')
  assert.ok(images.every(image => !image[1].onerror))
})

test('never evaluates author expressions or accepts unknown components', async () => {
  const { body } = await renderMarkdownContent([
    'Inline {{ $doc.secret }} value.',
    '::evil-widget{onclick="alert(1)"}',
    'Payload',
    '::',
    '::s-checkbox{label="Not supported"}',
    '::',
  ].join('\n'))

  const serialized = JSON.stringify(body)
  assert.doesNotMatch(serialized, /onclick|onClick/)
  assert.equal(find(body.nodes, node => node[0] === 'evil-widget'), null)
  assert.equal(find(body.nodes, node => node[0] === 's-checkbox'), null)
  assert.match(serialized, /\{\{ \$doc\.secret \}\}/)
})

test('renders approved Selaras declarative components and slots', async () => {
  const { body } = await renderMarkdownContent([
    '::s-card{variant="soft"}',
    '#header',
    '### Card title',
    '#default',
    'Card **body**.',
    '::',
    '',
    '::s-alert{title="Heads up" color="info"}',
    'Read this.',
    '::',
    '',
    '::s-table{data=\'[{"name":"Ada","role":"Admin"}]\' columns=\'[{"field":"name","header":"Name"},{"field":"role","header":"Role"}]\' striped}',
    '::',
  ].join('\n'))

  const card = find(body.nodes, node => node[0] === 's-card')
  assert.equal(card[1].variant, 'soft')
  assert.ok(find(card, node => node[0] === 'template' && node[1].name === 'header'))
  assert.ok(find(card, node => node[0] === 'template' && node[1].name === 'default'))

  const alert = find(body.nodes, node => node[0] === 's-alert')
  assert.equal(alert[1].color, 'info')
  assert.match(JSON.stringify(alert), /Read this/)

  const table = find(body.nodes, node => node[0] === 's-table')
  assert.equal(table[1].data[0].name, 'Ada')
  assert.equal(table[1].columns[1].header, 'Role')
})

test('normalizes aliases and rejects unsupported props', async () => {
  const { body } = await renderMarkdownContent([
    '::callout{type="tip" title="Read me"}\nBody\n::',
    '',
    '::s-icon{name="lucide:sparkles" color="primary"}\n::',
    '',
    '::s-icon{name="hugeicons:sparkles" onclick="alert(1)"}\n::',
    '',
    '::s-alert{title="Hello" ui=\'{"root":"fixed inset-0"}\' class="custom"}\nBody\n::',
  ].join('\n'))

  const callout = find(body.nodes, node => node[0] === 's-callout')
  assert.equal(callout[1].type, 'tip')
  assert.equal(callout[1].title, 'Read me')

  const icons = findAll(body.nodes, node => node[0] === 's-icon')
  assert.equal(icons.length, 2)
  assert.equal(icons[0][1].name, 'lucide:sparkles')
  assert.equal(icons[1][1].name, undefined)
  assert.equal(icons[0][1].onclick, undefined)

  const alert = find(body.nodes, node => node[0] === 's-alert')
  assert.equal(alert[1].ui, undefined)
  assert.equal(alert[1].class, undefined)
})

test('keeps GFM task-list checkboxes non-interactive', async () => {
  const { body } = await renderMarkdownContent('- [x] shipped\n- [ ] pending')
  const inputs = findAll(body.nodes, node => node[0] === 'input')
  assert.equal(inputs.length, 2)
  assert.ok(inputs.every(input => input[1].type === 'checkbox' && input[1].disabled === true))
})

test('rejects unsafe URL schemes in top-level component props', async () => {
  const { body } = await renderMarkdownContent([
    '::s-button{to="javascript:alert(1)"}\nGo\n::',
    '',
    '::s-button{to="jav&#x61;script:alert(1)"}\nGo\n::',
    '',
    '::s-button{to="data:text/html,<script>alert(1)</script>"}\nGo\n::',
    '',
    '::s-avatar{src="javascript:alert(1)" text="X"}\n::',
  ].join('\n'))

  const buttons = findAll(body.nodes, node => node[0] === 's-button')
  assert.equal(buttons.length, 3)
  assert.ok(buttons.every(button => button[1].to === undefined))
  const avatar = find(body.nodes, node => node[0] === 's-avatar')
  assert.equal(avatar[1].src, undefined)
})

test('sanitizes nested URLs and CSS-bearing keys inside component arrays', async () => {
  const { body } = await renderMarkdownContent([
    `::s-breadcrumb{items='[{"label":"X","to":"javascript:alert(1)"},{"label":"Y","to":"https://ok.example"}]'}`,
    '::',
    '',
    `::s-timeline{items='[{"id":"1","title":"T","src":"javascript:alert(1)","icon":"mdi:home","class":"fixed inset-0","ui":{"item":{"style":"position:fixed"}}}]'}`,
    '::',
    '',
    `::s-table{data='[{"name":"Ada","style":"position:fixed"}]' columns='[{"field":"name","header":"Name"}]'}`,
    '::',
  ].join('\n'))

  const serialized = JSON.stringify(body.nodes)
  assert.doesNotMatch(serialized, /javascript:/)
  assert.doesNotMatch(serialized, /position:fixed/)
  assert.doesNotMatch(serialized, /"class"/)
  assert.doesNotMatch(serialized, /mdi:home/)

  const breadcrumb = find(body.nodes, node => node[0] === 's-breadcrumb')
  assert.deepEqual(breadcrumb[1].items, [{ label: 'X' }, { label: 'Y', to: 'https://ok.example' }])
})

test('does not let a native element become an unvalidated dynamic component', async () => {
  const { body } = await renderMarkdownContent([
    '<div as="s-button" to="/workspace" ui="fixed inset-0">Injected</div>',
    '',
    '<div is="s-navigation-menu" items="[]"></div>',
  ].join('\n\n'))

  const serialized = JSON.stringify(body.nodes)
  assert.doesNotMatch(serialized, /"as":/)
  assert.doesNotMatch(serialized, /"is":/)
  assert.doesNotMatch(serialized, /fixed inset-0/)
})

test('renders GitHub alert blockquotes as Selaras callouts', async () => {
  const { body } = await renderMarkdownContent('> [!WARNING]\n> Warn body.')
  const callout = find(body.nodes, node => node[0] === 's-callout')
  assert.ok(callout, 'expected a callout node')
  assert.equal(callout[1].type, 'warning')
  assert.match(JSON.stringify(callout), /Warn body/)
})

test('accepts kebab-case props and bare boolean attributes', async () => {
  const { body } = await renderMarkdownContent([
    `::s-tabs{items='[{"label":"A","value":"a"}]' default-value="a"}`,
    '#a',
    'A',
    '::',
    '',
    `::s-table{data='[{"n":1}]' columns='[{"field":"n"}]' striped}`,
    '::',
    '',
    '::s-progress{model-value="68" max="100"}\n68%\n::',
  ].join('\n'))

  const tabs = find(body.nodes, node => node[0] === 's-tabs')
  assert.equal(tabs[1].defaultValue, 'a')
  const table = find(body.nodes, node => node[0] === 's-table')
  assert.equal(table[1].striped, true)
  const progress = find(body.nodes, node => node[0] === 's-progress')
  assert.equal(progress[1].modelValue, 68)
})

test('preserves legitimate nested data keys such as owner/onboarding but blocks event handlers', async () => {
  // These are real-world column names that must survive through Comark's security pass.
  const { body } = await renderMarkdownContent([
    `::s-table{data='[{"owner":"Ada","onboarding":true,"name":"A"}]' columns='[{"field":"owner","header":"Owner"}]'}\n::`,
    '',
    `::s-timeline{items='[{"id":"1","title":"x","onCall":"y","owner":"Ada"}]'}\n::`,
    '',
    `::s-navigation-menu{items='[{"label":"A","to":"/a","onboard":true}]'}\n::`,
  ].join('\n'))

  const table = find(body.nodes, node => node[0] === 's-table')
  assert.deepEqual(table[1].data, [{ owner: 'Ada', onboarding: true, name: 'A' }])

  const timeline = find(body.nodes, node => node[0] === 's-timeline')
  assert.deepEqual(timeline[1].items, [{ id: '1', title: 'x', onCall: 'y', owner: 'Ada' }])

  const nav = find(body.nodes, node => node[0] === 's-navigation-menu')
  assert.deepEqual(nav[1].items, [{ label: 'A', to: '/a', onboard: true }])
})

test('blocks event handlers inside data structures while allowing safe properties', async () => {
  const { body } = await renderMarkdownContent([
    `::s-table{data='[{"onclick":"evil","onerror":"x","safe":1,"oncall":"y"}]' columns='[{"field":"safe","header":"Safe"}]'}\n::`,
    '',
    `::s-timeline{items='[{"id":"1","class":"fixed inset-0","ui":{"item":{"style":"position:fixed"}},"onclick":"z"}]'}\n::`,
  ].join('\n'))

  const serialized = JSON.stringify(body.nodes)
  assert.doesNotMatch(serialized, /onclick/)
  assert.doesNotMatch(serialized, /onerror/)
  assert.doesNotMatch(serialized, /position:fixed/)
  assert.doesNotMatch(serialized, /class.*fixed/)

  const table = find(body.nodes, node => node[0] === 's-table')
  assert.deepEqual(table[1].data, [{ safe: 1, oncall: 'y' }])
})
