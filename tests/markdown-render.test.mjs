import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMarkdown } from '../server/utils/markdown.ts'

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
