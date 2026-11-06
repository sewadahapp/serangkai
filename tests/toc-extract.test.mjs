import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractToc } from '../app/utils/markdown-toc.ts'

test('builds a nested table of contents from rendered headings', () => {
  const html = [
    '<h1 id="top">Top</h1>',
    '<h2 id="one">One</h2>',
    '<p>text</p>',
    '<h3 id="one-a">One A</h3>',
    '<h2 id="two">Two</h2>',
  ].join('')
  const toc = extractToc(html)
  assert.deepEqual(toc.map(link => link.id), ['one', 'two'])
  assert.deepEqual(toc[0].children?.map(link => link.id), ['one-a'])
  assert.equal(toc[0].text, 'One')
  assert.equal(toc[0].depth, 2)
})

test('ignores headings without ids and depth outside the range', () => {
  const html = '<h1 id="title">Title</h1><h2>No id</h2><h4 id="deep">Deep</h4>'
  assert.deepEqual(extractToc(html), [])
})

test('decodes entities in heading text', () => {
  const toc = extractToc('<h2 id="a">Tom &amp; Jerry</h2><h2 id="b">B</h2>')
  assert.equal(toc[0].text, 'Tom & Jerry')
})
