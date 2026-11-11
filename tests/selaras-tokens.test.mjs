import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ALL_SELARAS_TOKENS,
  RESOLVED_TOKEN_NAMES,
  buildArtifactTokenCss,
  selarasTokensGuide,
} from '../shared/selaras-tokens.ts'
import { withDocumentTheme } from '../server/utils/artifact-theme.ts'
import { capabilities } from '../server/utils/authoring.ts'

const themed = '<!doctype html><html><head><meta name="serangkai-theme" content="selaras-document"><title>Doc</title></head><body><h1>Hello</h1></body></html>'

test('every advertised token uses the resolved wrapper and names are unique', () => {
  const names = ALL_SELARAS_TOKENS.map(token => token.name)
  assert.equal(new Set(names).size, names.length, 'token names must be unique')
  for (const token of ALL_SELARAS_TOKENS) {
    assert.equal(token.css, `var(--selaras-resolved-${token.name})`)
    assert.ok(token.purpose.length > 0)
  }
})

test('capabilities advertise the same token set as the catalog', () => {
  assert.deepEqual(capabilities.html.designTokens.tokens, ALL_SELARAS_TOKENS.map(t => t.name))
  assert.equal(capabilities.html.designTokens.reference, 'serangkai://tokens/selaras')
})

test('generated CSS declares a resolved wrapper for every token', () => {
  const css = buildArtifactTokenCss()
  for (const name of RESOLVED_TOKEN_NAMES) {
    assert.match(css, new RegExp(`--selaras-resolved-${name}: var\\(--selaras-${name}\\)`), `missing resolved ${name}`)
    assert.match(css, new RegExp(`--selaras-${name}:`), `missing semantic ${name}`)
  }
  // light/dark follows the viewer; the alternate theme is scoped by attribute.
  assert.match(css, /light-dark\(/)
  assert.match(css, /:root\[data-serangkai-theme='rose-pine'\]/)
})

test('generated CSS satisfies every token the Selaras prose stylesheet reads', async () => {
  const { readFile } = await import('node:fs/promises')
  const css = buildArtifactTokenCss()
  const prose = await readFile(new URL('../node_modules/@sewadah/selaras/dist/runtime/prose.css', import.meta.url), 'utf8')
  const used = [...prose.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1])
  for (const token of new Set(used)) {
    if (token.startsWith('--font') || token.startsWith('--selaras-prose-font')) continue
    assert.ok(css.includes(token), `generated CSS missing ${token}`)
  }
})

test('the token guide teaches the contract and the opt-in', () => {
  const guide = selarasTokensGuide()
  assert.match(guide, /var\(--selaras-resolved-/)
  assert.match(guide, /serangkai-theme/)
  assert.match(guide, /selaras-document/)
  assert.match(guide, /--selaras-resolved-color-accent-on-subtle/)
  assert.match(guide, /--selaras-resolved-surface-default/)
})

test('withDocumentTheme scopes tokens to the reader theme', () => {
  const rose = withDocumentTheme(themed, 'rose-pine')
  assert.match(rose, /<html data-serangkai-theme="rose-pine">/)
  assert.match(rose, /data-serangkai-document-theme/)

  const serangkai = withDocumentTheme(themed, 'serangkai')
  assert.match(serangkai, /data-serangkai-theme="serangkai"/)

  // No theme -> no attribute (base palette applies).
  const none = withDocumentTheme(themed)
  assert.doesNotMatch(none, /data-serangkai-theme=/)

  // Invalid theme is ignored, and injection stays idempotent.
  assert.doesNotMatch(withDocumentTheme(themed, 'not-a-theme'), /data-serangkai-theme=/)
  assert.equal(withDocumentTheme(rose, 'rose-pine'), rose)
})
