import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { chromium } from 'playwright-core'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, adminUsername, adminPassword } from './helpers/auth.mjs'

const port = 4200 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, browser
before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-shell-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'db.sqlite'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
})
after(async () => { await browser?.close(); child?.kill(); await rm(dataDir, { recursive: true, force: true }) })

test('workspace is the private home and uses a responsive app sidebar', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && message.text().includes('[serangkai]')) errors.push(message.text()) })
  try {
    await page.goto(base)
    await page.waitForURL('**/auth/login')
    await page.getByLabel('Username').fill(adminUsername)
    await page.getByLabel('Password').fill(adminPassword)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL(`${base}/`)
    await page.getByRole('heading', { name: 'Rangka', exact: true }).waitFor()
    const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' })
    await sidebar.getByRole('button', { name: 'All rangka' }).waitFor()
    assert.equal(await page.getByRole('link', { name: 'Overview', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'New folder', exact: true }).click()
    await page.getByLabel('Folder name').fill('Research')
    await page.getByRole('button', { name: 'Create folder', exact: true }).click()
    await sidebar.getByRole('treeitem', { name: /^Research/ }).waitFor()
    await page.evaluate(async () => {
      for (const [title, type, content] of [['Research notes', 'markdown', '# Research notes'], ['Project brief', 'html', '<h1>Project brief</h1>'], ['Ideas to explore', 'markdown', '# Ideas']]) {
        await fetch('/api/rangka', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, type, content }) })
      }
    })
    await page.reload()
    await page.getByRole('link', { name: /^Research notes/ }).waitFor()
    await page.screenshot({ path: '/tmp/serangkai-shell-desktop.png' })
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 800 })
      const dimensions = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth])
      assert.ok(dimensions[1] <= dimensions[0], `overflow at ${width}: ${dimensions}`)
      assert.equal(await sidebar.isVisible(), false)
      await page.getByRole('button', { name: 'Browse folders' }).click()
      const folders = page.getByRole('dialog', { name: 'Folders', exact: true })
      await folders.getByRole('treeitem', { name: /^Research/ }).click()
      await folders.waitFor({ state: 'hidden' })
    }
    await page.setViewportSize({ width: 375, height: 800 })
    await page.screenshot({ path: '/tmp/serangkai-shell-mobile.png' })
    await page.goto(`${base}/dashboard`)
    await page.waitForURL(`${base}/`)
    await page.goto(`${base}/workspace`)
    await page.getByRole('heading', { name: 'Rangka', exact: true }).waitFor()
    await page.goto(`${base}/agent`)
    await page.getByRole('heading', { name: 'Connect an agent' }).waitFor()
    assert.equal(errors.length, 0, errors.join('\n'))
  } finally { await context.close() }
})

test('folder tree separates expansion, selection, and actions across desktop and mobile', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await context.request.post(`${base}/api/auth/login`, { data: { username: adminUsername, password: adminPassword } })
    const createFolder = async (name, parentId) => {
      const response = await context.request.post(`${base}/api/folders`, { data: { name, ...(parentId ? { parentId } : {}) } })
      assert.ok(response.ok(), await response.text())
      return (await response.json()).folder
    }
    const root = await createFolder('Tree projects')
    const planning = await createFolder('Tree planning', root.id)
    const notes = await createFolder('Tree notes', root.id)
    const design = await createFolder('Tree design', planning.id)
    await context.request.post(`${base}/api/rangka`, { data: { title: 'Tree document', type: 'markdown', content: '# Tree document', folderId: design.id } })
    await page.goto(base)
    const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' })
    const rootRow = sidebar.getByRole('treeitem', { name: /^Tree projects/ })
    await rootRow.waitFor()
    assert.equal(await rootRow.getAttribute('aria-expanded'), 'false')
    await rootRow.getByText('Tree projects', { exact: true }).click()
    await page.getByRole('heading', { name: 'Tree projects', exact: true }).waitFor()
    assert.equal(await rootRow.getAttribute('aria-expanded'), 'false', 'selecting a folder does not open its children')
    assert.match(await rootRow.innerText(), /1/)
    await rootRow.locator('[data-folder-toggle]').click()
    await page.reload()
    await rootRow.waitFor()
    assert.equal(await rootRow.getAttribute('aria-expanded'), 'true', 'open branches survive reloads')
    assert.equal(await sidebar.getByRole('treeitem', { name: /^Tree planning/ }).getAttribute('aria-expanded'), 'false')
    await rootRow.locator('[data-folder-toggle]').click()
    await page.reload()
    await rootRow.waitFor()
    assert.equal(await rootRow.getAttribute('aria-expanded'), 'false')
    assert.equal(await sidebar.getByRole('treeitem', { name: /^Tree planning/ }).count(), 0)
    await sidebar.getByRole('link', { name: 'Agents', exact: true }).click()
    await page.getByRole('heading', { name: 'Connect an agent', exact: true }).waitFor()
    await sidebar.getByRole('link', { name: 'Workspace', exact: true }).click()
    await rootRow.waitFor()
    assert.equal(await rootRow.getAttribute('aria-expanded'), 'false', 'collapsed branches survive navigation')
    await rootRow.focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await rootRow.getAttribute('aria-expanded'), 'true')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await page.getByRole('heading', { name: 'Tree notes', exact: true }).waitFor()
    await sidebar.getByRole('button', { name: 'Actions for Tree planning', exact: true }).click()
    assert.equal(await page.locator('#rangka-list').innerText(), 'Tree notes')
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    await page.getByLabel('Folder name').fill('Tree planning renamed')
    await page.getByRole('button', { name: 'Save name', exact: true }).click()
    await sidebar.getByRole('treeitem', { name: /^Tree planning renamed/ }).waitFor()
    await page.screenshot({ path: '/tmp/serangkai-folder-tree-desktop.png' })
    await page.setViewportSize({ width: 320, height: 800 })
    await page.getByRole('button', { name: 'Browse folders', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Folders', exact: true })
    const mobileRoot = drawer.getByRole('treeitem', { name: /^Tree projects/ })
    await mobileRoot.locator('[data-folder-toggle]').click()
    assert.equal(await mobileRoot.getAttribute('aria-expanded'), 'false')
    assert.equal(await drawer.isVisible(), true)
    await mobileRoot.locator('[data-folder-toggle]').click()
    await drawer.getByRole('treeitem', { name: /^Tree planning renamed/ }).locator('[data-folder-toggle]').click()
    await page.screenshot({ path: '/tmp/serangkai-folder-tree-mobile.png' })
    await drawer.getByRole('treeitem', { name: /^Tree design/ }).getByText('Tree design', { exact: true }).click()
    await drawer.waitFor({ state: 'hidden' })
    await page.getByRole('heading', { name: 'Tree design', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Browse folders', exact: true }).click()
    await drawer.getByRole('treeitem', { name: /^Tree planning renamed/ }).locator('[data-folder-toggle]').click()
    await drawer.getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Search rangka and folders' }).fill('Tree document')
    await page.getByText('1 found', { exact: false }).waitFor()
    await page.getByRole('button', { name: 'Browse folders', exact: true }).click()
    assert.equal(await drawer.getByRole('treeitem', { name: /^Tree planning renamed/ }).getAttribute('aria-expanded'), 'false', 'a refresh does not reopen a manually collapsed ancestor')
    await drawer.getByRole('button', { name: 'All rangka' }).click()
    await drawer.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Browse folders', exact: true }).click()
    assert.equal(await drawer.locator('[aria-selected="true"]').count(), 0)
    const [viewport, content] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth])
    assert.ok(content <= viewport)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})

test('private entry routes redirect to login while shared rangka remain readable', async () => {
  for (const path of ['/', '/workspace', '/dashboard', '/agent', '/settings']) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' })
    assert.equal(response.status, 302)
    assert.match(response.headers.get('location'), /^\/auth\/login/)
  }
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: adminUsername, password: adminPassword }) })
  const cookie = login.headers.get('set-cookie')
  const rangka = (await (await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Public document', type: 'markdown', content: '# Shared document', visibility: 'public' }) })).json()).rangka
  const shared = await fetch(`${base}/share/${rangka.slug}`)
  assert.equal(shared.status, 200)
  assert.match(await shared.text(), /Shared document/)
})

test('rangka grid and list preserve filtering, pagination, and the chosen view', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  try {
    await page.goto(`${base}/auth/login`)
    await page.getByLabel('Username').fill(adminUsername)
    await page.getByLabel('Password').fill(adminPassword)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL(`${base}/`)
    await page.evaluate(async () => {
      const headers = { 'content-type': 'application/json' }
      const folder = (await (await fetch('/api/folders', { method: 'POST', headers, body: JSON.stringify({ name: 'Grid examples' }) })).json()).folder
      for (let i = 0; i < 26; i++) {
        const response = await fetch('/api/rangka', { method: 'POST', headers, body: JSON.stringify({ title: `Grid sample ${i} with a long descriptive title for the layout`, type: 'markdown', content: '# Example', folderId: folder.id, visibility: i === 0 ? 'public' : 'private' }) })
        if (!response.ok) throw new Error('Could not create grid example')
      }
    })
    await page.reload()
    await page.getByRole('complementary', { name: 'Workspace sidebar' }).getByRole('treeitem', { name: /^Grid examples/ }).click()
    await page.getByText('26 rangka', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Grid view' }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.locator('.workspace-rangka-grid .workspace-rangka').count(), 25)
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const [viewport, content] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth])
      assert.ok(content <= viewport, `grid overflows at ${width}: ${content}`)
    }
    await page.screenshot({ path: '/tmp/serangkai-rangka-grid.png' })
    await page.getByRole('navigation', { name: 'Rangka pages' }).getByRole('button', { name: 'Next' }).click()
    await page.getByText('Page 2 of 2').waitFor()
    assert.equal(await page.locator('.workspace-rangka-grid .workspace-rangka').count(), 1)
    await page.getByRole('button', { name: 'List view', exact: true }).click()
    assert.equal(await page.locator('.workspace-rangka-grid').count(), 0)
    await page.reload()
    assert.equal(await page.getByRole('button', { name: 'List view' }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'Grid view', exact: true }).click()
    await page.reload()
    await page.locator('.workspace-rangka-grid').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Grid view' }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('searchbox', { name: 'Search rangka and folders' }).fill('Grid sample 0 with')
    await page.getByText('1 found', { exact: false }).waitFor()
    assert.equal(await page.locator('.workspace-rangka').count(), 1)
    await page.getByRole('link', { name: /^Preview Grid sample 0/ }).waitFor()
  } finally { await context.close() }
})

test('rangka menus support management from list and grid on desktop and mobile', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  try {
    await page.goto(`${base}/auth/login`)
    await page.getByLabel('Username').fill(adminUsername)
    await page.getByLabel('Password').fill(adminPassword)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL(`${base}/`)
    const id = await page.evaluate(async () => {
      const headers = { 'content-type': 'application/json' }
      await fetch('/api/folders', { method: 'POST', headers, body: JSON.stringify({ name: 'Action destination' }) })
      const created = await fetch('/api/rangka', { method: 'POST', headers, body: JSON.stringify({ title: 'Action example', type: 'markdown', content: '# Keep this content' }) })
      return (await created.json()).rangka.id
    })
    await page.reload()
    await page.getByRole('button', { name: 'List view', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Search rangka and folders' }).fill('Action example')
    await page.getByText('1 found', { exact: false }).waitFor()
    await page.getByRole('button', { name: 'Actions for Action example', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click()
    await page.getByText('2 found', { exact: false }).waitFor()
    await page.screenshot({ path: '/tmp/serangkai-list-actions.png' })
    await page.getByRole('button', { name: 'Grid view', exact: true }).click()
    await page.getByRole('button', { name: 'Actions for Action example', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    await page.getByLabel('Rangka title').fill('Action example renamed')
    await page.getByRole('button', { name: 'Save name', exact: true }).click()
    await page.getByRole('link', { name: /^Action example renamed/ }).waitFor()
    await page.setViewportSize({ width: 320, height: 800 })
    await page.getByRole('button', { name: 'Actions for Action example renamed', exact: true }).click()
    await page.getByRole('button', { name: 'Move to folder', exact: true }).click()
    await page.getByRole('combobox', { name: 'Move to', exact: true }).click()
    await page.getByRole('option', { name: 'Action destination', exact: true }).click()
    await page.getByRole('button', { name: 'Move rangka', exact: true }).click()
    await page.getByRole('link', { name: /^Action example renamed/ }).getByText(/Action destination/).waitFor()
    await page.getByRole('button', { name: 'Actions for Action example renamed', exact: true }).click()
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    await page.getByRole('combobox', { name: 'Visibility', exact: true }).click()
    await page.getByRole('option', { name: 'Unlisted', exact: true }).click()
    await page.getByRole('button', { name: 'Save visibility', exact: true }).click()
    const share = page.getByRole('textbox', { name: 'Share link', exact: true })
    await share.waitFor()
    assert.match(await share.inputValue(), /\/share\/.+\?k=[a-f0-9]{64}$/)
    assert.equal((await fetch(await share.inputValue())).status, 200)
    await page.getByRole('dialog', { name: 'Share rangka', exact: true }).getByRole('button', { name: 'Done', exact: true }).click()
    const beforeDelete = await page.evaluate(async id => (await (await fetch(`/api/rangka/${id}`)).json()), id)
    assert.equal(beforeDelete.content, '# Keep this content')
    assert.equal(beforeDelete.rangka.visibility, 'unlisted')
    await page.getByRole('button', { name: 'Actions for Action example renamed', exact: true }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete rangka', exact: true }).click()
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Actions for Action example renamed', exact: true }).waitFor({ state: 'hidden' })
    await page.getByRole('link', { name: /^Action example \(copy\)/ }).waitFor()
    const [viewport, content] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth])
    assert.ok(content <= viewport)
  } finally { await context.close() }
})

test('Selaras tooltips describe actions and preserve dropdown triggers', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  try {
    await page.goto(`${base}/auth/login`)
    await page.getByLabel('Username').fill(adminUsername)
    await page.getByLabel('Password').fill(adminPassword)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL(`${base}/`)
    const create = page.getByRole('button', { name: 'New folder', exact: true })
    assert.equal(await create.getAttribute('title'), null)
    await create.hover()
    await page.getByRole('tooltip').getByText('New folder', { exact: true }).waitFor()
    await create.click()
    await page.getByRole('dialog', { name: 'Create folder', exact: true }).waitFor()
    await page.getByRole('dialog', { name: 'Create folder', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click()
    const folder = await page.evaluate(async () => {
      const result = await fetch('/api/folders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Tooltip folder' }) })
      return (await result.json()).folder
    })
    await page.reload()
    const action = page.getByRole('button', { name: `Actions for ${folder.name}`, exact: true })
    await action.hover()
    await page.getByRole('tooltip').getByText(`Actions for ${folder.name}`, { exact: true }).waitFor()
    await action.click()
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    await page.getByRole('dialog', { name: 'Rename folder', exact: true }).waitFor()
  } finally { await context.close() }
})

test('anchored rangka menus leave space at the viewport edges', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  try {
    await page.goto(`${base}/auth/login`)
    await page.getByLabel('Username').fill(adminUsername)
    await page.getByLabel('Password').fill(adminPassword)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL(`${base}/`)
    await page.evaluate(async () => {
      await fetch('/api/rangka', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Viewport edge example', type: 'markdown', content: '# Example' }) })
    })
    await page.reload()
    await page.getByRole('searchbox', { name: 'Search rangka and folders' }).fill('Viewport edge example')
    const action = page.getByRole('button', { name: 'Actions for Viewport edge example', exact: true })
    await action.waitFor()
    // Exercise collision handling with the trigger at the extreme bottom-right.
    await action.evaluate(button => { button.parentElement.style.cssText = 'position:fixed;right:0;bottom:0;z-index:40' })
    await action.click()
    await page.getByRole('menu').waitFor()
    await page.waitForFunction(() => {
      const menu = document.querySelector('[role="menu"]')
      if (!menu) return false
      const bounds = menu.getBoundingClientRect()
      return bounds.left >= 11 && bounds.top >= 11 && bounds.right <= innerWidth - 11 && bounds.bottom <= innerHeight - 11
    })
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
    await page.getByRole('dialog', { name: 'Rename rangka', exact: true }).waitFor()
  } finally { await context.close() }
})

test('Markdown readers use wider centered content and an independent contents rail', async () => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1000 } })
  const page = await context.newPage()
  try {
    await page.goto(`${base}/auth/login`)
    await page.getByLabel('Username').fill(adminUsername)
    await page.getByLabel('Password').fill(adminPassword)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL(`${base}/`)
    const item = await page.evaluate(async () => {
      const content = '# Centered reader\n\n' + Array.from({ length: 12 }, (_, i) => `## Topic ${i + 1}\n\n${'A paragraph that keeps the document readable across screen sizes. '.repeat(10)}`).join('\n\n')
      const result = await fetch('/api/rangka', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Centered reader', type: 'markdown', content, visibility: 'public' }) })
      return (await result.json()).rangka
    })
    await page.goto(`${base}/rangka/${item.id}`)
    const content = page.locator('.rangka-document-markdown .selaras-prose')
    await content.waitFor()
    const prose = await content.boundingBox()
    assert.ok(prose.width >= 820 && prose.width <= 880, `detail prose should be wider: ${prose.width}`)
    await page.goto(`${base}/share/${item.slug}`)
    for (const width of [1920, 1536, 1280, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      const article = await page.locator('.share-markdown-article').boundingBox()
      assert.ok(Math.abs(article.x + article.width / 2 - width / 2) <= 1, `document should be centered at ${width}px`)
      const dimensions = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth])
      assert.ok(dimensions[1] <= dimensions[0], `shared reader overflows at ${width}px: ${dimensions}`)
      const rail = page.getByRole('complementary', { name: 'Table of contents' })
      if (width >= 1536) {
        const bounds = await rail.boundingBox()
        assert.ok(bounds.x >= article.x + article.width + 20, 'contents should sit beyond the document')
        assert.ok(bounds.x + bounds.width <= width - 16, 'contents should fit inside the viewport')
        assert.ok(article.width >= 850 && article.width <= 880)
      } else {
        assert.equal(await rail.isVisible(), false)
        await page.getByRole('button', { name: 'On this page', exact: true }).waitFor()
      }
    }
    await page.getByRole('button', { name: 'On this page', exact: true }).click()
    await page.locator('.share-toc-compact').getByRole('link', { name: 'Topic 1', exact: true }).click()
    assert.equal(new URL(page.url()).hash, '#topic-1')
    await page.setViewportSize({ width: 1920, height: 1000 })
    await page.goto(`${base}/share/${item.slug}`)
    await page.screenshot({ path: '/tmp/serangkai-centered-share.png' })
  } finally { await context.close() }
})

test('integrated add and edit screens retain navigation and protect unsaved drafts', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  try {
    await context.request.post(`${base}/api/auth/login`, { data: { username: adminUsername, password: adminPassword } })
    await page.goto(`${base}/workspace/new`)
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Integrated draft')
    const editor = page.getByRole('textbox', { name: 'Content', exact: true })
    await editor.fill('# Integrated draft')
    const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' })
    await sidebar.getByRole('link', { name: 'Agents', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(new URL(page.url()).pathname, '/workspace/new')
    assert.equal(await editor.innerText(), '# Integrated draft')
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      const layout = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        editorLeft: document.querySelector('.serangkai-editor-workspace').getBoundingClientRect().left,
        statusBottom: document.querySelector('.serangkai-editor-status').getBoundingClientRect().bottom,
      }))
      assert.ok(layout.content <= layout.viewport, `add screen overflows at ${width}px`)
      assert.equal(layout.editorLeft, width >= 1024 ? 256 : 0)
      assert.ok(layout.statusBottom <= 901, 'editor footer stays within the viewport')
      if (width === 390 || width === 1440) await page.screenshot({ path: `/tmp/serangkai-add-${width}.png` })
    }
    await page.getByRole('button', { name: 'Create rangka', exact: true }).click()
    await page.waitForURL('**/rangka/**')
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await editor.fill('# Unsaved edit')
    await page.setViewportSize({ width: 1440, height: 900 })
    await sidebar.getByRole('link', { name: 'Workspace', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(await editor.innerText(), '# Unsaved edit')
    await page.getByRole('button', { name: 'Close editor', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    assert.equal(await editor.innerText(), '# Integrated draft')
    await editor.fill('# Saved draft')
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 })
      assert.ok(await sidebar.isVisible() === (width >= 1024))
      const [viewport, content] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth])
      assert.ok(content <= viewport, `edit screen overflows at ${width}px`)
      if (width === 390 || width === 1440) await page.screenshot({ path: `/tmp/serangkai-edit-${width}.png` })
    }
    await editor.focus()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s')
    await page.getByText('Saved version 2', { exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Saved draft', exact: true }).waitFor()
  } finally { await context.close() }
})

test('color mode lives in Settings and the desktop account label has a direct logout', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' })
  const page = await context.newPage()
  try {
    await page.goto(`${base}/auth/login`)
    await page.getByLabel('Username').fill(adminUsername)
    await page.getByLabel('Password').fill(adminPassword)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL(`${base}/`)
    const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' })
    await sidebar.getByText(adminUsername, { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: `Account menu for ${adminUsername}` }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Toggle color mode', exact: true }).count(), 0)
    await sidebar.getByRole('link', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Toggle color mode', exact: true }).click()
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    await page.reload()
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    await page.getByRole('button', { name: 'Toggle color mode', exact: true }).click()
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
    await sidebar.getByRole('button', { name: 'Log out', exact: true }).click()
    await page.waitForURL(`${base}/auth/login`)
    await page.getByRole('heading', { name: 'Log in to Serangkai' }).waitFor()
    await page.goto(base)
    await page.waitForURL(`${base}/auth/login`)
  } finally { await context.close() }
})

test('Markdown code tokens switch palettes in dark mode in both readers', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' })
  const page = await context.newPage()
  const assertTokenPalette = async dark => {
    const tokens = page.locator('.serangkai-shiki span[style*="--shiki-dark"]')
    await tokens.first().waitFor()
    const colors = await tokens.evaluateAll((spans, dark) => spans.map(span => {
      const expected = dark ? span.style.getPropertyValue('--shiki-dark').trim() : span.style.color || span.style.getPropertyValue('--shiki-light').trim()
      const probe = document.createElement('span')
      probe.style.color = expected
      document.body.append(probe)
      const normalized = getComputedStyle(probe).color
      probe.remove()
      return { actual: getComputedStyle(span).color, expected: normalized }
    }), dark)
    assert.ok(colors.length > 5)
    for (const color of colors) assert.equal(color.actual, color.expected, JSON.stringify(color))
  }
  try {
    await page.goto(`${base}/auth/login`)
    await page.getByLabel('Username').fill(adminUsername)
    await page.getByLabel('Password').fill(adminPassword)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await page.waitForURL(`${base}/`)
    const item = await page.evaluate(async () => {
      const result = await fetch('/api/rangka', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Code palette', type: 'markdown', content: '# Data Model\n\n```typescript\ninterface User {\n  id: string\n  username: string | null\n  createdAt: Date\n}\n```', visibility: 'public' }) })
      return (await result.json()).rangka
    })
    await page.goto(`${base}/rangka/${item.id}`)
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    await assertTokenPalette(true)
    await page.goto(`${base}/share/${item.slug}`)
    await assertTokenPalette(true)
    await page.getByRole('button', { name: 'Toggle color mode', exact: true }).click()
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
    await assertTokenPalette(false)
    await page.getByRole('button', { name: 'Toggle color mode', exact: true }).click()
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    await assertTokenPalette(true)
    await page.goto(`${base}/agent`)
    await assertTokenPalette(true)
  } finally { await context.close() }
})
