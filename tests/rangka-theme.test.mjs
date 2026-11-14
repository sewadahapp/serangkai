import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withDocumentTheme, wantsDocumentTheme } from '../server/utils/rangka-theme.ts'

const themed = '<!doctype html><html><head><meta name="serangkai-theme" content="selaras-document"><title>Doc</title></head><body><h1>Hello</h1></body></html>'

test('does not touch self-styled rangka', () => {
  const plain = '<!doctype html><html><head><title>Plain</title></head><body><h1>Hello</h1></body></html>'
  assert.equal(wantsDocumentTheme(plain), false)
  assert.equal(withDocumentTheme(plain), plain)
})

test('injects the document theme only when explicitly requested', () => {
  assert.equal(wantsDocumentTheme(themed), true)
  const result = withDocumentTheme(themed)
  assert.match(result, /data-serangkai-document-theme/)
  assert.match(result, /\/rangka-themes\/selaras-document\.css/)
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

test('the generated theme and its font are usable from a sandboxed opaque origin', async () => {
  const { readFile } = await import('node:fs/promises')
  const theme = await readFile(new URL('../public/rangka-themes/selaras-document.css', import.meta.url), 'utf8')
  // The theme points at a same-origin webfont; the delivery route must add the
  // CORS header because a sandboxed iframe has an opaque origin.
  assert.match(theme, /url\("\/fonts\/plus-jakarta-sans-latin\.woff2"\)/)
  const config = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
  assert.match(config, /'\/fonts\/\*\*': \{ headers: \{ 'Access-Control-Allow-Origin': '\*' \} \}/)
  // Every token the prose stylesheet reads must be declared, or the document
  // silently loses typography/colour when Selaras changes its token names.
  const selarasProse = await readFile(new URL('../node_modules/@sewadah/selaras/dist/runtime/prose.css', import.meta.url), 'utf8')
  const used = [...selarasProse.matchAll(/var\((--[a-z0-9-]+)/g)].map(match => match[1])
  for (const token of new Set(used)) {
    if (token.startsWith('--font') || token.startsWith('--selaras-prose-font')) continue
    assert.match(theme, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing theme token ${token}`)
  }
})
