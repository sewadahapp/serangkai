import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DEFAULT_THEME, isThemeId, themes } from '../shared/themes.ts'

const css = readFileSync(new URL('../app/assets/css/main.css', import.meta.url), 'utf8')
const roles = ['primary', 'accent', 'secondary', 'success', 'info', 'warning', 'danger', 'neutral']
const leaves = [
  'fill',
  'fill-hover',
  'fill-pressed',
  'on-fill',
  'indicator',
  'subtle',
  'subtle-hover',
  'subtle-pressed',
  'on-subtle',
  'text',
  'text-hover',
  'text-pressed',
  'border',
  'focus',
]
const globals = [
  '--selaras-surface-canvas',
  '--selaras-surface-default',
  '--selaras-surface-elevated',
  '--selaras-surface-inverted',
  '--selaras-text-default',
  '--selaras-text-muted',
  '--selaras-text-inverted',
  '--selaras-border-default',
  '--selaras-border-muted',
  '--selaras-border-hover',
  '--selaras-scrim',
]

function cssBlock(selector) {
  const start = css.indexOf(selector)
  assert.ok(start >= 0, `missing ${selector}`)
  const bodyStart = css.indexOf('{', start)
  let depth = 0
  for (let index = bodyStart; index < css.length; index++) {
    if (css[index] === '{') depth++
    if (css[index] === '}' && --depth === 0) return css.slice(bodyStart + 1, index)
  }
  assert.fail(`unterminated ${selector}`)
}

function value(block, token) {
  const match = block.match(new RegExp(`${token}:\\s*([^;]+);`))
  assert.ok(match, `missing ${token}`)
  return match[1].trim()
}

function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map(part => Number.parseInt(part, 16) / 255)
    .map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((left, right) => right - left)
  return (light + 0.05) / (dark + 0.05)
}

test('theme registry has unique ids and a valid default', () => {
  assert.equal(new Set(themes.map(theme => theme.id)).size, themes.length)
  assert.ok(themes.some(theme => theme.id === DEFAULT_THEME))
  for (const theme of themes) {
    assert.ok(isThemeId(theme.id))
    for (const mode of ['light', 'dark']) {
      for (const color of Object.values(theme.preview[mode])) {
        assert.match(color, /^#[0-9a-f]{6}$/i, `${theme.id} ${mode} preview colors must be hex`)
      }
    }
  }
  assert.equal(isThemeId('unknown-theme'), false)
  assert.equal(isThemeId(''), false)
  assert.equal(isThemeId(null), false)
})

test('every non-default theme has complete light and dark token recipes', () => {
  for (const theme of themes.filter(entry => entry.id !== DEFAULT_THEME)) {
    for (const [mode, selector] of [
      ['light', `:root[data-serangkai-theme='${theme.id}']`],
      ['dark', `:root.dark[data-serangkai-theme='${theme.id}']`],
    ]) {
      const block = cssBlock(selector)
      for (const token of globals) value(block, token)
      for (const role of roles) {
        for (const leaf of leaves) value(block, `--selaras-color-${role}-${leaf}`)
      }

      assert.equal(value(block, '--selaras-surface-default'), theme.preview[mode].surface)
      assert.equal(value(block, '--selaras-color-primary-fill'), theme.preview[mode].primary)
      assert.equal(value(block, '--selaras-color-accent-fill'), theme.preview[mode].accent)
    }
  }
})

test('theme text and role colors keep readable contrast', () => {
  for (const theme of themes.filter(entry => entry.id !== DEFAULT_THEME)) {
    for (const selector of [
      `:root[data-serangkai-theme='${theme.id}']`,
      `:root.dark[data-serangkai-theme='${theme.id}']`,
    ]) {
      const block = cssBlock(selector)
      const surface = value(block, '--selaras-surface-default')
      const elevated = value(block, '--selaras-surface-elevated')
      assert.ok(contrast(value(block, '--selaras-text-default'), surface) >= 4.5, `${selector} text contrast`)
      assert.ok(contrast(value(block, '--selaras-text-muted'), elevated) >= 4.5, `${selector} muted text contrast`)

      for (const role of roles) {
        assert.ok(
          contrast(value(block, `--selaras-color-${role}-on-fill`), value(block, `--selaras-color-${role}-fill`)) >= 4.5,
          `${selector} ${role} on-fill contrast`,
        )
        assert.ok(
          contrast(value(block, `--selaras-color-${role}-on-subtle`), value(block, `--selaras-color-${role}-subtle`)) >= 4.5,
          `${selector} ${role} on-subtle contrast`,
        )
        assert.ok(
          contrast(value(block, `--selaras-color-${role}-text`), surface) >= 4.5,
          `${selector} ${role} text contrast`,
        )
      }
    }
  }
})
