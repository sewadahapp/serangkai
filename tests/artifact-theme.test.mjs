import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withDocumentTheme, wantsDocumentTheme } from '../server/utils/artifact-theme.ts'

const themed = '<!doctype html><html><head><meta name="serangkai-theme" content="selaras-document"><title>Doc</title></head><body><h1>Hello</h1></body></html>'

test('does not touch self-styled artifacts', () => {
  const plain = '<!doctype html><html><head><title>Plain</title></head><body><h1>Hello</h1></body></html>'
  assert.equal(wantsDocumentTheme(plain), false)
  assert.equal(withDocumentTheme(plain), plain)
})

test('injects the document theme only when explicitly requested', () => {
  assert.equal(wantsDocumentTheme(themed), true)
  const result = withDocumentTheme(themed)
  assert.match(result, /data-serangkai-document-theme/)
  assert.match(result, /\/artifact-themes\/selaras-document\.css/)
  assert.match(result, /<head>/)
})

test('does not inject the theme twice', () => {
  const once = withDocumentTheme(themed)
  assert.equal(withDocumentTheme(once), once)
})

test('ignores an unknown theme name', () => {
  const unknown = themed.replace('selaras-document', 'something-else')
  assert.equal(wantsDocumentTheme(unknown), false)
  assert.equal(withDocumentTheme(unknown), unknown)
})

test('adds a head when only a body tag exists', () => {
  const result = withDocumentTheme('<html><body><h1>Hello</h1><meta name="serangkai-theme" content="selaras-document"></body></html>')
  assert.match(result, /<head><link[^>]+selaras-document\.css/)
})
