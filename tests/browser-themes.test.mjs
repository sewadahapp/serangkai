import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { chromium } from 'playwright-core'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, adminPassword, adminUsername } from './helpers/auth.mjs'
import { themes } from '../shared/themes.ts'

const port = 3820 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, browser

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-themes-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
})

after(async () => { await browser?.close(); child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

async function loggedInPage(colorScheme = 'light') {
  const context = await browser.newContext({ colorScheme })
  const page = await context.newPage()
  await page.request.post(`${base}/api/auth/login`, { data: { username: adminUsername, password: adminPassword } })
  await page.goto(`${base}/settings`, { waitUntil: 'networkidle' })
  return { context, page }
}

const rgb = hex => {
  let n = hex.replace('#', '')
  if (n.length === 3) n = n.split('').map(c => c + c).join('')
  return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`
}
const toRgb = value => value.trim().startsWith('rgb') ? value.trim() : rgb(value.trim())
const bodyBg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
// Resolve a token to a concrete RGB by painting it on a probe element; custom
// properties may hold var()/theme() references that getPropertyValue won't resolve.
const tokenRgb = (page, name) => page.evaluate(n => {
  const d = document.createElement('div')
  d.style.background = `var(${n})`
  document.body.appendChild(d)
  const c = getComputedStyle(d).backgroundColor
  d.remove()
  return c
}, name)

test('every theme applies instantly, persists, and resolves light and dark surfaces', async () => {
  const canvasByTheme = {}
  for (const scheme of ['light', 'dark']) {
    const { context, page } = await loggedInPage(scheme)
    try {
      for (const theme of themes) {
        await page.getByRole('radio', { name: new RegExp(theme.label) }).click()
        await page.waitForFunction(id => document.documentElement.dataset.serangkaiTheme === id, theme.id)
        const surface = await tokenRgb(page, '--selaras-resolved-surface-default')
        // Override themes ship exact hex palettes; the compiled default uses
        // oklch, so only assert it resolves to a real color.
        if (theme.id !== 'serangkai') {
          assert.equal(surface, rgb(theme.preview[scheme].surface), `${theme.id} ${scheme} surface`)
        } else {
          assert.ok(/^(rgb|oklch|color)/.test(surface), `default ${scheme} surface resolves`)
        }
        const canvas = await tokenRgb(page, '--selaras-resolved-surface-canvas')
        assert.equal(await bodyBg(page), canvas, `${theme.id} ${scheme} body paints canvas`)
        canvasByTheme[theme.id] = { ...canvasByTheme[theme.id], [scheme]: canvas }
        await page.reload({ waitUntil: 'networkidle' })
        assert.equal(await page.locator('html').getAttribute('data-serangkai-theme'), theme.id)
        await page.getByRole('link', { name: 'Overview' }).first().click()
        await page.waitForURL('**/dashboard')
        assert.equal(await page.locator('html').getAttribute('data-serangkai-theme'), theme.id)
        await page.goto(`${base}/settings`, { waitUntil: 'networkidle' })
      }
    } finally { await context.close() }
  }
  for (const theme of themes) {
    assert.notEqual(canvasByTheme[theme.id].light, canvasByTheme[theme.id].dark, `${theme.id} light and dark must differ`)
  }
})

test('theme preview swatches match the registered palette', async () => {
  const { context, page } = await loggedInPage('light')
  try {
    for (const theme of themes) {
      const card = page.locator('label', { hasText: theme.label }).first()
      const swatch = card.locator('[aria-hidden="true"] > span').first()
      assert.equal(await swatch.evaluate(el => getComputedStyle(el).backgroundColor), rgb(theme.preview.light.surface), `${theme.id} light swatch`)
    }
  } finally { await context.close() }
})

test('public readers follow the viewer theme preference', async () => {
  const { context, page } = await loggedInPage('light')
  try {
    const slug = await page.evaluate(async () => {
      const res = await fetch('/api/rangka', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Reader theme', type: 'markdown', content: '# Reader', visibility: 'public' }) })
      return (await res.json()).rangka.slug
    })
    const viewer = await browser.newContext({ colorScheme: 'light' })
    await viewer.addCookies([{ name: 'serangkai-theme', value: 'catppuccin', domain: '127.0.0.1', path: '/' }])
    const reader = await viewer.newPage()
    await reader.goto(`${base}/share/${slug}`, { waitUntil: 'networkidle' })
    assert.equal(await reader.locator('html').getAttribute('data-serangkai-theme'), 'catppuccin')
    assert.equal(await tokenRgb(reader, '--selaras-resolved-surface-default'), rgb(themes.find(t => t.id === 'catppuccin').preview.light.surface))
    await viewer.close()
  } finally { await context.close() }
})

test('HTML rangka opting into the document theme receive resolved tokens', async () => {
  const { context, page } = await loggedInPage('light')
  try {
    await page.getByRole('radio', { name: /Flexoki/ }).click()
    await page.waitForFunction(() => document.documentElement.dataset.serangkaiTheme === 'flexoki')
    const id = await page.evaluate(async () => {
      const content = '<!doctype html><html><head><meta name="serangkai-theme" content="selaras-document"><style>.card{background:var(--selaras-resolved-surface-default);color:var(--selaras-resolved-text-default);border:1px solid var(--selaras-resolved-border-default)}</style></head><body><div class="card">Token card</div></body></html>'
      const res = await fetch('/api/rangka', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Token doc', type: 'html', content }) })
      return (await res.json()).rangka.id
    })
    await page.goto(`${base}/rangka/${id}`, { waitUntil: 'networkidle' })
    const frame = page.frameLocator('iframe')
    await frame.locator('.card').waitFor()
    assert.equal(await frame.locator('.card').evaluate(el => getComputedStyle(el).backgroundColor), rgb(themes.find(t => t.id === 'flexoki').preview.light.surface))
  } finally { await context.close() }
})

test('mobile viewports do not overflow on workspace, settings, and reader', async () => {
  const { context, page } = await loggedInPage('light')
  try {
    await page.setViewportSize({ width: 390, height: 844 })
    const slug = await page.evaluate(async () => {
      const res = await fetch('/api/rangka', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Mobile reader', type: 'markdown', content: '# Mobile\n\n| A | B |\n| --- | --- |\n| 1 | 2 |', visibility: 'public' }) })
      return (await res.json()).rangka.slug
    })
    for (const path of ['/workspace', '/settings', `/share/${slug}`]) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      assert.ok(overflow <= 1, `${path} horizontal overflow ${overflow}px`)
    }
  } finally { await context.close() }
})
