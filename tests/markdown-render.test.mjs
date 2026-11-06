import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMarkdown, renderMarkdownAsync } from '../server/utils/markdown.ts'
import { normalizeLanguage, isSupportedLanguage } from '../server/utils/highlight.ts'

test('renders Mermaid fences as safe interactive markers', () => {
  const html = renderMarkdown('```mermaid\ngraph TD\n  A --> B\n```')
  assert.match(html, /class="serangkai-mermaid"/)
  assert.match(html, /data-mermaid=/)
  assert.match(html, /graph TD/)
})

test('renders valid chart JSON as a chart marker', () => {
  const html = renderMarkdown('```chart\n{"type":"bar","xKey":"month","yKey":"value","data":[{"month":"Jan","value":10}]}\n```')
  assert.match(html, /class="serangkai-chart"/)
  assert.match(html, /data-chart=/)
})

test('keeps invalid chart JSON visible without executable HTML', () => {
  const html = renderMarkdown('```chart\nnot json\n```')
  assert.match(html, /serangkai-chart-error/)
  assert.doesNotMatch(html, /<script/i)
})

test('highlights fenced code with Shiki and keeps the copy affordance', async () => {
  const html = await renderMarkdownAsync('```ts\nconst x: number = 1\n```')
  assert.match(html, /class="serangkai-code"/)
  assert.match(html, /data-language="ts"/)
  assert.match(html, /class="serangkai-code-header"/)
  assert.match(html, /data-serangkai-copy/)
  // dual-theme span custom properties, switched by CSS per mode
  assert.match(html, /--shiki-light:/)
  assert.match(html, /--shiki-dark:/)
  // exactly one code element, not doubled
  assert.equal((html.match(/<code>/g) || []).length, 1)
})

test('falls back to escaped text for unknown languages', async () => {
  const html = await renderMarkdownAsync('```notalanguage\n<b>raw</b> & text\n```')
  assert.match(html, /class="serangkai-code"/)
  assert.match(html, /&lt;b&gt;raw&lt;\/b&gt; &amp; text/)
  assert.doesNotMatch(html, /<b>raw<\/b>/)
  assert.doesNotMatch(html, /--shiki-light/)
})

test('highlighting never emits executable markup', async () => {
  const html = await renderMarkdownAsync('```html\n<script>alert(1)</script>\n```')
  // No real <script> element survives sanitization...
  assert.doesNotMatch(html, /<script/i)
  // ...and the angle brackets remain escaped even though Shiki splits them
  // across span boundaries, so check the entities rather than the joined tag.
  assert.match(html, /&lt;/)
  assert.match(html, /&gt;</)
  assert.match(html, /alert/)
  // No inline event handler or javascript: URL slipped through either.
  assert.doesNotMatch(html, /onerror=/i)
  assert.doesNotMatch(html, /javascript:/i)
})

test('mermaid and chart fences are not syntax highlighted', async () => {
  const mermaid = await renderMarkdownAsync('```mermaid\ngraph TD\n A-->B\n```')
  assert.match(mermaid, /serangkai-mermaid/)
  assert.doesNotMatch(mermaid, /--shiki-light/)
  const chart = await renderMarkdownAsync('```chart\n{"type":"bar"}\n```')
  assert.match(chart, /serangkai-chart/)
  assert.doesNotMatch(chart, /--shiki-light/)
})

test('normalizes common language aliases', () => {
  assert.equal(normalizeLanguage('sh'), 'bash')
  assert.equal(normalizeLanguage('yml'), 'yaml')
  assert.equal(normalizeLanguage('py'), 'python')
  assert.equal(normalizeLanguage('TS'), 'ts')
  assert.equal(normalizeLanguage(''), '')
})
