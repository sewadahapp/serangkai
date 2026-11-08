import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { defaultIcons } from '../node_modules/@sewadah/selaras/dist/runtime/utils/icons.js'
import { selarasIcons, selarasIconNames } from '../shared/selaras-icons.ts'

const lucide = JSON.parse(readFileSync(new URL('../node_modules/@iconify-json/lucide/icons.json', import.meta.url), 'utf8'))

function hasLucideIcon(name) {
  const icon = name.replace(/^lucide:/, '')
  return Boolean(lucide.icons[icon] || lucide.aliases?.[icon])
}

test('overrides every Selaras internal icon with Lucide', () => {
  assert.deepEqual(Object.keys(selarasIcons).sort(), Object.keys(defaultIcons).sort())
  for (const [key, name] of Object.entries(selarasIcons)) {
    assert.match(name, /^lucide:/, `${key} must use a Lucide icon`)
    assert.ok(hasLucideIcon(name), `${key} points to missing icon ${name}`)
  }
})

test('prebundles every overridden icon for the client', () => {
  assert.deepEqual(selarasIconNames.sort(), [...new Set(Object.values(selarasIcons))].sort())
})
