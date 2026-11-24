import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { buffer } from 'node:stream/consumers'
import { test, before, after } from 'node:test'
import { chromium } from 'playwright-core'
import { ZipFile } from 'yazl'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, adminPassword, adminUsername } from './helpers/auth.mjs'

const port = 3720 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, browser, page
// Log in once the app has mounted, so these tests exercise the client-side
// login (the pre-hydration form post has its own test).
const hydrated = () => !!document.getElementById('__nuxt')?.__vue_app__

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-browser-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
  page = await browser.newPage()
})

after(async () => { await browser?.close(); child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('human browser workflow logs in and creates a rangka', async () => {
  await page.goto(`${base}/`)
  await assert.doesNotReject(() => page.getByText('Serangkai').first().waitFor())
  await page.getByRole('heading', { name: 'Log in to Serangkai' }).waitFor()
  await page.getByLabel('Username').fill(adminUsername)
  await page.getByLabel('Password').fill(adminPassword)
  await page.waitForFunction(hydrated)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL(/\/(?:workspace)?$/)
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Rangka', exact: true }).waitFor())
  await page.getByRole('button', { name: 'New folder' }).click()
  await page.getByLabel('Folder name').fill('Projects')
  // The folder picker must open real options (Reka rejects an empty-string
  // option value, which previously left the parent list empty).
  await page.getByRole('combobox', { name: 'Parent' }).click()
  await assert.doesNotReject(() => page.getByRole('option', { name: 'Top level' }).waitFor())
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Create folder' }).click()
  await assert.doesNotReject(() => page.getByRole('treeitem', { name: /^Projects/ }).waitFor())
  await page.getByRole('treeitem', { name: /^Projects/ }).click()
  await page.getByRole('button', { name: 'New rangka' }).first().click()
  await page.waitForURL('**/workspace/new?*')
  await page.getByLabel('Title').first().fill('Browser-created rangka')
  await page.getByRole('textbox', { name: 'Content' }).fill('# Browser flow')
  await page.getByRole('button', { name: 'Create rangka' }).click()
  await page.waitForURL('**/rangka/**')
  await page.getByRole('link', { name: 'Workspace', exact: true }).first().click()
  await page.waitForURL(/\/(?:workspace)?$/)
  // Each row shows its folder path next to the type.
  await assert.doesNotReject(() => page.locator('.workspace-rangka-folder', { hasText: 'Projects' }).first().waitFor())
  await page.getByRole('button', { name: 'Actions for Projects' }).click()
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.getByLabel('Folder name').fill('Programs')
  await page.getByRole('button', { name: 'Save name' }).click()
  await assert.doesNotReject(() => page.getByRole('treeitem', { name: /^Programs/ }).waitFor())
  await assert.doesNotReject(() => page.locator('.workspace-rangka-folder', { hasText: 'Programs' }).first().waitFor())
  await page.getByRole('button', { name: 'All rangka' }).click()
  await page.getByRole('button', { name: 'New folder' }).click()
  await page.getByLabel('Folder name').fill('Archive')
  await page.getByRole('button', { name: 'Create folder' }).click()
  await assert.doesNotReject(() => page.getByRole('treeitem', { name: /^Archive/ }).waitFor())
  await page.getByRole('treeitem', { name: /^Programs/ }).click()
  await page.getByRole('button', { name: 'Actions for Programs' }).click()
  await page.getByRole('menuitem', { name: 'Move' }).click()
  await page.getByRole('combobox', { name: 'Move under' }).click()
  await page.getByRole('option', { name: 'Archive' }).click()
  await page.getByRole('button', { name: 'Move folder' }).click()
  await assert.doesNotReject(() => page.getByText('Folder moved', { exact: true }).waitFor())
  await assert.doesNotReject(() => page.locator('.workspace-rangka-folder', { hasText: 'Archive / Programs' }).first().waitFor())
  await page.getByPlaceholder('Search rangka and folders…').fill('Browser')
  await assert.doesNotReject(() => page.getByText(/in Programs and its subfolders/).waitFor())
  // Searching must keep the folder tree and the row's folder path intact.
  await assert.doesNotReject(() => page.getByRole('treeitem', { name: /^Programs/ }).waitFor())
  await assert.doesNotReject(() => page.locator('.workspace-rangka-folder', { hasText: 'Archive / Programs' }).first().waitFor())
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Programs', exact: true }).waitFor())
  await assert.doesNotReject(() => page.getByText('1 rangka', { exact: true }).waitFor())
  await page.getByRole('link', { name: /^Browser-created rangka/ }).click()
  await page.waitForURL('**/rangka/**')
  await page.getByRole('region', { name: 'Rangka content' }).waitFor()
  assert.equal(await page.getByRole('combobox', { name: 'Visibility' }).count(), 0)
  await page.screenshot({ path: '/tmp/serangkai-reader-desktop.png' })
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await page.getByRole('combobox', { name: 'Visibility' }).click()
  await page.getByRole('option', { name: /Unlisted/ }).click()
  const shareLink = page.getByRole('textbox', { name: 'Share link', exact: true })
  await assert.doesNotReject(() => shareLink.waitFor())
  assert.match(await shareLink.inputValue(), /\/share\/[^?]+\?k=[a-f0-9]{64}$/)
  assert.equal((await fetch(await shareLink.inputValue())).status, 200)

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  await page.getByRole('button', { name: 'Copy share link' }).click()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await shareLink.inputValue())
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('textbox', { name: 'Content' }).fill('# Browser flow revised')
  await page.getByRole('button', { name: 'Save version' }).click()
  await assert.doesNotReject(() => page.getByText('Saved version 2').waitFor())
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: 'View' }).last().click()
  await assert.doesNotReject(() => page.getByText('# Browser flow', { exact: true }).first().waitFor())
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Restore' }).last().click()
  await assert.doesNotReject(() => page.getByText('Restored version 1 as version 3.').waitFor())
  await assert.doesNotReject(() => page.getByRole('button', { name: 'View version 3', exact: true }).waitFor())
  // Older versions can be deleted from the row's actions menu; the current one cannot.
  await page.getByRole('button', { name: 'Actions for version 1', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Delete version' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete version' }).click()
  await assert.doesNotReject(() => page.getByText(/^Deleted version 1, freeing /).waitFor())
  await page.getByRole('button', { name: 'View version 1', exact: true }).waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Actions for version 3', exact: true }).click()
  assert.equal(await page.getByRole('menuitem', { name: 'Delete version' }).count(), 0)
  await page.keyboard.press('Escape')
  const history = page.getByRole('dialog', { name: 'Version history', exact: true })
  await history.getByRole('button', { name: 'Close', exact: true }).click()
  await history.waitFor({ state: 'hidden' })

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.waitForURL('**/settings')
  await page.getByRole('button', { name: 'Create token', exact: true }).click()
  await page.getByLabel('Name').fill('Browser token')
  await page.getByRole('dialog', { name: 'Create token', exact: true }).getByRole('button', { name: 'Create token', exact: true }).click()
  const tokenField = page.getByLabel('New API token')
  await assert.doesNotReject(() => tokenField.waitFor())
  assert.match(await tokenField.inputValue(), /^[A-Za-z0-9_-]{32}$/)
  await page.getByRole('dialog', { name: 'Token created', exact: true }).getByRole('button', { name: 'Done', exact: true }).click()
  await tokenField.waitFor({ state: 'hidden' })
  await assert.doesNotReject(() => page.getByText('Browser token').first().waitFor())

  await page.getByRole('link', { name: 'Agents' }).first().click()
  await page.waitForURL('**/agent')
  // Endpoints live in the Manual setup tab; the agent prompt is the default.
  await page.getByRole('tab', { name: 'Manual setup', exact: true }).click()
  await assert.doesNotReject(() => page.getByRole('textbox', { name: 'MCP endpoint', exact: true }).waitFor())
  assert.match(await page.getByRole('textbox', { name: 'MCP endpoint', exact: true }).inputValue(), /\/api\/mcp$/)
  assert.match(await page.getByRole('textbox', { name: 'REST endpoint', exact: true }).inputValue(), /\/api\/rangka$/)
  await page.getByRole('button', { name: 'MCP tools', exact: true }).click()
  await assert.doesNotReject(() => page.getByText('list_folders').first().waitFor())
  await page.getByRole('tab', { name: 'API token', exact: true }).click()
  await assert.doesNotReject(() => page.getByText(/Bearer YOUR_TOKEN/).waitFor())

  await page.getByRole('link', { name: 'Workspace', exact: true }).first().click()
  await page.waitForURL(`${base}/`)
  await page.getByRole('heading', { name: 'Rangka', exact: true }).waitFor()
  await assert.doesNotReject(() => page.getByText('Browser-created rangka').first().waitFor())

  await page.getByRole('link', { name: 'Workspace', exact: true }).first().click()
  await page.waitForURL(/\/(?:workspace)?$/)
  const preview = page.getByRole('link', { name: 'Preview Browser-created rangka' })
  await assert.doesNotReject(() => preview.waitFor())
  assert.match(await preview.getAttribute('href'), /\/share\/[^?]+\?k=[a-f0-9]{64}$/)
  await page.getByRole('link', { name: /^Browser-created rangka/ }).click()
  await page.waitForURL('**/rangka/**')
  await page.getByRole('button', { name: 'Rangka actions' }).click()
  await assert.doesNotReject(() => page.getByRole('menuitem', { name: 'Download' }).waitFor())
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete rangka' }).click()
  await page.waitForURL(/\/(?:workspace)?$/)
  await assert.doesNotReject(() => page.getByText('No rangka yet').waitFor())

  await page.getByRole('button', { name: 'Upload' }).click()
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
  await page.locator('input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: pixel })
  await page.getByRole('button', { name: 'Upload rangka' }).click()
  await assert.doesNotReject(() => page.getByText('pixel').first().waitFor())
  await page.getByRole('link', { name: /pixel/ }).first().click()
  await page.waitForURL('**/rangka/**')
  const image = page.getByRole('img', { name: 'pixel' })
  await assert.doesNotReject(() => image.waitFor())
  assert.equal(await image.evaluate(element => element.complete && element.naturalWidth), 1)

  await page.getByRole('button', { name: 'Rangka actions' }).click()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'pixel (copy)' }).waitFor())
})

test('the login form works before client hydration', async () => {
  const cold = await browser.newContext()
  const coldPage = await cold.newPage()
  try {
    // Simulate a cold first load whose client JS has not arrived yet. The
    // server-rendered form must sign in natively instead of doing a GET of the
    // login page that wipes the typed credentials.
    await coldPage.route('**/_nuxt/**', route =>
      /\.(?:js|mjs)(?:\?|$)/.test(route.request().url()) ? route.abort() : route.continue(),
    )
    await coldPage.goto(`${base}/auth/login`)
    await coldPage.getByLabel('Username').fill(adminUsername)
    await coldPage.getByLabel('Password').fill(adminPassword)
    await coldPage.getByRole('button', { name: 'Log in' }).click()
    await coldPage.waitForURL(/\/(?:workspace)?$/)
    await assert.doesNotReject(() => coldPage.getByRole('heading', { name: 'Rangka', exact: true }).waitFor())
  } finally {
    await cold.close()
  }
})

test('Markdown renders Mermaid diagrams and JSON charts', async () => {
  await page.goto(`${base}/workspace`)
  const rangkaId = await page.evaluate(async () => {
    const content = [
      '# Render check',
      '',
      '## Diagram',
      '',
      '```mermaid',
      'graph LR',
      '  A[Client] --> B[Server]',
      '```',
      '',
      '## Chart',
      '',
      '```chart',
      '{"type":"bar","title":"Routes","data":[{"label":"auth","value":4},{"label":"rangka","value":13}]}',
      '```',
    ].join('\n')
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Render check', type: 'markdown', content }),
    })
    return (await res.json()).rangka.id
  })

  await page.goto(`${base}/rangka/${rangkaId}`)
  await assert.doesNotReject(() => page.locator('.serangkai-mermaid svg').first().waitFor())
  await assert.doesNotReject(() => page.locator('.ts-chart-host svg').first().waitFor())
  assert.equal(await page.locator('.serangkai-mermaid svg').count(), 1)
  assert.equal(await page.locator('.ts-chart-host svg').count(), 1)
  assert.equal(await page.locator('.serangkai-chart pre').count(), 0)
  // Charts must use the active theme's categorical palette, not TanStack's
  // hard-coded fallback. The first mark uses --ts-chart-1.
  const chartFills = await page.locator('.ts-chart-host svg rect').evaluateAll(rects => rects.map(rect => getComputedStyle(rect).fill))
  assert.ok(chartFills.includes('rgb(11, 122, 94)'), `expected Serangkai chart jade, got ${chartFills.join(', ')}`)

  // Selaras spaces blocks with a direct-child selector. Comark wraps the
  // document in its own element, so `selaras-prose` must sit on that wrapper;
  // otherwise headings sit flush against Mermaid diagrams and charts.
  assert.equal(await page.locator('.comark-content.selaras-prose').count(), 1)
  const rhythm = await page.evaluate(() => {
    function gapAfter(text) {
      const heading = [...document.querySelectorAll('.comark-content > h2')]
        .find(element => element.textContent?.trim() === text)
      const next = heading?.nextElementSibling
      if (!heading || !next) return null
      return next.getBoundingClientRect().top - heading.getBoundingClientRect().bottom
    }
    return { mermaid: gapAfter('Diagram'), chart: gapAfter('Chart') }
  })
  assert.ok(rhythm.mermaid !== null && rhythm.mermaid >= 12, `Mermaid needs rhythm after its heading: ${rhythm.mermaid}`)
  assert.ok(rhythm.chart !== null && rhythm.chart >= 12, `Chart needs rhythm after its heading: ${rhythm.chart}`)

  // Headings get ids for deep links...
  const headingId = await page.locator('h2', { hasText: 'Diagram' }).getAttribute('id')
  assert.equal(headingId, 'diagram')
  // ...but the in-app preview stays focused on the document itself.
  await assert.rejects(() => page.locator('section[aria-label="Contents"]').waitFor({ timeout: 500 }))
})

test('Markdown renders Selaras document components', async () => {
  await page.goto(`${base}/workspace`)
  const rangkaId = await page.evaluate(async () => {
    const content = [
      '# Component check',
      '',
      '## Overview',
      '',
      '| Name | Role |',
      '| --- | --- |',
      '| Ada | Admin |',
      '',
      '::s-alert{title="Heads up" description="A Selaras alert." color="info"}',
      '::',
      '',
      '::s-card{variant="soft"}',
      '#header',
      '### Release notes',
      '#default',
      'Card body.',
      '::',
      '',
      '::s-tabs{items=\'[{"label":"Overview","value":"overview"},{"label":"Details","value":"details"}]\' default-value="overview"}',
      '#overview',
      'Overview content.',
      '#details',
      'Details content.',
      '::',
      '',
      '::s-accordion{items=\'[{"value":"one","label":"First section"},{"value":"two","label":"Second section"}]\' default-value="one"}',
      '#one',
      'First body.',
      '#two',
      'Second body.',
      '::',
      '',
      '::s-table{data=\'[{"name":"Ada","role":"Admin"},{"name":"Lin","role":"Member"}]\' columns=\'[{"field":"name","header":"Name"},{"field":"role","header":"Role"}]\' striped}',
      '::',
    ].join('\n')
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Component check', type: 'markdown', content }),
    })
    return (await res.json()).rangka.id
  })

  await page.goto(`${base}/rangka/${rangkaId}`)
  await page.locator('.selaras-prose [data-selaras-color]').first().waitFor({ timeout: 15000 })
  await page.getByRole('tab', { name: 'Overview' }).first().waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'First section' }).first().waitFor({ timeout: 15000 })
  assert.ok(await page.locator('.selaras-prose [data-selaras-color]').count() >= 1)
  assert.ok(await page.getByRole('tab', { name: 'Overview' }).count() >= 1)
  assert.ok(await page.getByRole('button', { name: 'First section' }).count() >= 1)
  const tableHeaders = await page.locator('th').allInnerTexts()
  assert.ok(tableHeaders.includes('Name'))
  assert.ok(tableHeaders.includes('Role'))
  assert.ok(await page.locator('tbody tr').count() >= 2)
})

test('the share reader shows a table of contents', async () => {
  await page.setViewportSize({ width: 1600, height: 900 })
  const shareUrl = await page.evaluate(async () => {
    const content = [
      '# Shared doc',
      '',
      '## Diagram',
      '',
      'Text.',
      '',
      '## Chart',
      '',
      'More text.',
    ].join('\n')
    const created = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Shared doc', type: 'markdown', content, visibility: 'unlisted' }),
    })
    const { rangka } = await created.json()
    const link = await fetch(`/api/rangka/${rangka.id}/share`, { method: 'POST' })
    return (await link.json()).url
  })

  await page.goto(shareUrl)
  const tocLinks = page.locator('aside[aria-label="Table of contents"] a')
  await assert.doesNotReject(() => tocLinks.first().waitFor())
  assert.deepEqual(await tocLinks.allInnerTexts(), ['Diagram', 'Chart'])
  // The rail links to real headings, so SContentToc can track them.
  const href = await tocLinks.first().getAttribute('href')
  assert.equal(await page.locator(href).count(), 1)
  // The public reader reuses MarkdownDocument, so Comark's wrapper owns the
  // Selaras prose class here too and paragraphs get their sibling rhythm.
  assert.equal(await page.locator('.comark-content.selaras-prose').count(), 1)
  const paragraphGap = await page.evaluate(() => {
    const heading = [...document.querySelectorAll('.comark-content > h2')]
      .find(element => element.textContent?.trim() === 'Diagram')
    const next = heading?.nextElementSibling
    return heading && next
      ? next.getBoundingClientRect().top - heading.getBoundingClientRect().bottom
      : null
  })
  assert.ok(paragraphGap !== null && paragraphGap >= 12, `shared Markdown needs block rhythm: ${paragraphGap}`)
  await page.setViewportSize({ width: 1280, height: 720 })
})

test('JSON rangka are syntax highlighted in the preview', async () => {
  const rangkaId = await page.evaluate(async () => {
    const form = new FormData()
    form.append('file', new File(['{"brand":"Sewadah","concepts":[{"name":"Shared Space"}]}'], 'presentation-spec.json', { type: 'application/json' }), 'presentation-spec.json')
    form.append('title', 'presentation-spec')
    const res = await fetch('/api/rangka/upload', { method: 'POST', body: form })
    return (await res.json()).rangka.id
  })

  await page.goto(`${base}/rangka/${rangkaId}`)
  await assert.doesNotReject(() => page.locator('.serangkai-shiki span[style*="--shiki-light"]').first().waitFor())
  assert.ok(await page.locator('.serangkai-shiki span[style*="--shiki-light"]').count() > 0)
  assert.match(await page.locator('.serangkai-prose, main').innerText(), /presentation-spec\.json/)
})

test('source rangka open in a full editor with syntax highlighting', async () => {
  const rangkaId = await page.evaluate(async () => {
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'HTML editing',
        type: 'html',
        content: '<!doctype html>\n<html>\n  <body>\n    <h1>Hello</h1>\n  </body>\n</html>',
      }),
    })
    return (await res.json()).rangka.id
  })

  await page.goto(`${base}/rangka/${rangkaId}`)
  await page.getByRole('button', { name: 'Edit' }).click()
  const editor = page.getByRole('textbox', { name: 'Content' })
  await editor.waitFor()
  await assert.doesNotReject(() => page.getByText('html-editing.html').waitFor())
  await assert.doesNotReject(() => page.getByText('UTF-8').waitFor())
  assert.ok(await page.locator('.cm-lineNumbers .cm-gutterElement').count() > 0)

  // The theme must give HTML tokens more than one colour, not plain text.
  const colors = await editor.evaluate((element) => {
    const spans = [...element.querySelectorAll('span')]
    return [...new Set(spans.map(span => getComputedStyle(span).color))]
  })
  assert.ok(colors.length > 1, `expected highlighted colours, got ${colors.join(', ')}`)

  await editor.fill('<h1>Edited from the editor</h1>')
  // CodeMirror's Mod-s is Ctrl on Linux/Windows but Cmd on macOS.
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s')
  await assert.doesNotReject(() => page.getByText('Saved version 2').waitFor())
  await assert.doesNotReject(() => page.frameLocator('iframe').getByText('Edited from the editor').waitFor())
})

test('the JSON editor surfaces parse errors before saving', async () => {
  const rangkaId = await page.evaluate(async () => {
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Release metadata', type: 'json', content: '{\n  "version": "0.1.0"\n}' }),
    })
    return (await res.json()).rangka.id
  })

  await page.goto(`${base}/rangka/${rangkaId}`)
  await page.getByRole('button', { name: 'Edit' }).click()
  const editor = page.getByRole('textbox', { name: 'Content' })
  await editor.waitFor()
  await editor.fill('{\n  "version":\n}')
  await assert.doesNotReject(() => page.locator('.cm-lintPoint-error, .cm-lint-marker-error').first().waitFor({ timeout: 4000 }))
  // The marker follows the parser's error node instead of defaulting to line 1.
  assert.equal(await page.locator('.cm-line').nth(2).locator('.cm-lintPoint-error').count(), 1)
  await page.getByRole('button', { name: 'Close editor', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await editor.waitFor({ state: 'hidden' })
})

test('HTML rangka render Mermaid and TanStack charts in the sandbox', async () => {
  const rangkaId = await page.evaluate(async () => {
    const content = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Rich HTML rangka</title></head>
  <body>
    <h1>Launch dashboard</h1>
    <pre class="mermaid">flowchart LR
  Draft --> Review
  Review --> Share</pre>
    <script type="application/json" data-serangkai-chart>
      {"type":"bar","title":"Requests by week","data":[{"week":"W1","value":12},{"week":"W2","value":19},{"week":"W3","value":8}],"x":"week","y":"value","color":"#2563eb"}
    </script>
    <script type="application/json" data-serangkai-chart>
      {"type":"line","title":"Latency","data":[{"week":"W1","value":320},{"week":"W2","value":280},{"week":"W3","value":240}],"x":"week","y":"value","color":"#ea580c"}
    </script>
    <div data-serangkai-chart='{"type":"bar","horizontal":true,"title":"Releases","data":[{"team":"Web","value":14},{"team":"API","value":9},{"team":"Agents","value":5}],"x":"team","y":"value"}'></div>
  </body>
</html>`
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Rich HTML rangka', type: 'html', content }),
    })
    return (await res.json()).rangka.id
  })

  await page.goto(`${base}/rangka/${rangkaId}`)
  const frame = page.frameLocator('iframe')
  await frame.locator('.serangkai-mermaid svg').waitFor({ timeout: 15000 })
  await frame.locator('.serangkai-chart-figure svg').first().waitFor({ timeout: 15000 })
  assert.equal(await frame.locator('.serangkai-chart-figure svg').count(), 3)
  assert.equal(await frame.locator('.serangkai-mermaid svg').count(), 1)
  assert.equal(await frame.locator('.serangkai-runtime-error').count(), 0)
  assert.match(await frame.locator('.serangkai-mermaid').innerText(), /Draft/)
})

test('fixed canvases fit, zoom, and pan in both rangka readers', async () => {
  const owner = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  try {
    const signedIn = await owner.request.post(`${base}/api/auth/login`, {
      data: { username: adminUsername, password: adminPassword },
    })
    assert.ok(signedIn.ok())
    const content = `<!doctype html><html><head>
      <meta name="serangkai-canvas" content="1920x1080">
      <style>
        body { margin: 0; height: 100vh; display: grid; place-items: center }
        input, #scroll-panel { position: absolute; left: calc(50% + 180px); width: 240px }
        input { top: calc(50% - 60px) }
        #scroll-panel { top: 50%; height: 150px; overflow: auto }
      </style>
      </head><body>
        <button id="board-control" data-clicks="0" onclick="this.dataset.clicks = Number(this.dataset.clicks) + 1">Board control</button>
        <input aria-label="Board text">
        <div id="scroll-panel"><div style="height: 1000px">Scrollable report</div></div>
        <img src="/api/health?canvas-loading-probe" alt="" hidden>
      </body></html>`
    const html = await owner.request.post(`${base}/api/rangka`, {
      data: { title: 'HTML canvas', type: 'html', visibility: 'public', content },
    })
    assert.ok(html.ok())
    const archive = new ZipFile()
    archive.addBuffer(Buffer.from(content), 'index.html')
    archive.end()
    const bundle = await owner.request.post(`${base}/api/rangka/upload`, {
      multipart: {
        title: 'Bundle canvas', visibility: 'public',
        file: { name: 'canvas.zip', mimeType: 'application/zip', buffer: await buffer(archive.outputStream) },
      },
    })
    assert.ok(bundle.ok())

    const workspace = await owner.newPage()
    const share = await guest.newPage()
    const touch = await guest.newCDPSession(share)
    async function assertShareCanvasHeight(bounds) {
      const header = await share.getByRole('banner').boundingBox()
      const footer = await share.getByRole('contentinfo').boundingBox()
      assert.ok(Math.abs(bounds.y - header.y - header.height) <= 1, 'Canvas starts below the share header')
      assert.ok(Math.abs(bounds.y + bounds.height - footer.y) <= 1, 'Canvas fills the share reader down to its footer')
      assert.ok(Math.abs(footer.y + footer.height - share.viewportSize().height) <= 1, 'A canvas share fits the viewport')
    }

    for (const response of [html, bundle]) {
      const { rangka } = await response.json()
      for (const [reader, path] of [[workspace, `/rangka/${rangka.id}`], [share, `/share/${rangka.slug}`]]) {
        await reader.bringToFront()
        const checkLoading = reader === share && response === html
        if (checkLoading) {
          const assetStarted = Promise.withResolvers()
          const releaseAsset = Promise.withResolvers()
          const releaseDocument = Promise.withResolvers()
          const asset = '**/api/health?canvas-loading-probe'
          await reader.route(base + '/api/share/' + rangka.slug, async (route) => {
            await releaseDocument.promise
            await route.continue()
          }, { times: 1 })
          await reader.route(asset, async (route) => {
            assetStarted.resolve()
            await releaseAsset.promise
            await route.fulfill({ status: 204 })
          }, { times: 1 })
          try {
            await reader.goto(base + path, { waitUntil: 'domcontentloaded' })
            await reader.locator('iframe').waitFor({ state: 'attached' })
            const loader = reader.getByRole('status').filter({ hasText: 'Loading preview…' })
            await loader.waitFor()
            assert.equal(await reader.locator('iframe').isVisible(), false, 'The loading preview must hide the unscaled HTML')
            assert.equal(await reader.getByRole('group', { name: 'Canvas controls' }).isVisible(), false)
            const piece = loader.locator('.serangkai-logo rect').first()
            assert.notEqual(await piece.evaluate(element => getComputedStyle(element).animationName), 'none')
            await reader.emulateMedia({ reducedMotion: 'reduce' })
            assert.equal(await piece.evaluate(element => getComputedStyle(element).animationName), 'none')
            await reader.emulateMedia({ reducedMotion: 'no-preference' })
            await reader.evaluate(() => {
              function sampleFirstVisibleFrame() {
                const frame = document.querySelector('main iframe')
                if (getComputedStyle(frame).visibility === 'hidden') {
                  requestAnimationFrame(sampleFirstVisibleFrame)
                  return
                }
                const controls = document.querySelector('[aria-label="Canvas controls"]')
                window.firstCanvasPaint = {
                  fitted: frame.getBoundingClientRect().width < innerWidth,
                  controlsVisible: controls && getComputedStyle(controls).visibility === 'visible',
                }
              }
              requestAnimationFrame(sampleFirstVisibleFrame)
            })
            releaseDocument.resolve()
            await assetStarted.promise
            const controls = reader.getByRole('group', { name: 'Canvas controls' })
            await controls.waitFor()
            const firstCanvas = reader.getByRole('region', { name: 'Rangka canvas' })
            const fittedWidth = (await firstCanvas.locator('iframe').boundingBox()).width
            await controls.getByRole('button', { name: 'Zoom in', exact: true }).click()
            releaseAsset.resolve()
            const loaded = await (await firstCanvas.locator('iframe').elementHandle()).contentFrame()
            await loaded.waitForLoadState('load')
            assert.ok((await firstCanvas.locator('iframe').boundingBox()).width > fittedWidth, 'Late assets preserve the user zoom')
            await controls.getByRole('button', { name: 'Fit canvas' }).click()
          } finally {
            releaseDocument.resolve()
            releaseAsset.resolve()
          }
        } else {
          await reader.goto(base + path)
        }
        const canvas = reader.getByRole('region', { name: 'Rangka canvas', exact: true })
        await canvas.waitFor()
        await reader.getByRole('group', { name: 'Canvas controls' }).waitFor()
        const frame = canvas.locator('iframe')
        assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts')
        const inner = await (await frame.elementHandle()).contentFrame()
        const content = canvas.frameLocator('iframe')
        const control = content.getByRole('button', { name: 'Board control' })
        const input = content.getByRole('textbox', { name: 'Board text' })
        const controlPosition = await control.evaluate(element => {
          const rect = element.getBoundingClientRect()
          return {
            x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
            size: [window.innerWidth, window.innerHeight],
          }
        })
        assert.deepEqual(controlPosition.size, [1920, 1080])
        const settleBoard = () => canvas.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        // Let Chromium commit the new iframe transform before using raw device coordinates.
        await settleBoard()
        if (checkLoading) {
          assert.deepEqual(await reader.evaluate(() => window.firstCanvasPaint), { fitted: true, controlsVisible: true })
        }
        const bounds = await canvas.boundingBox()
        const initial = await frame.boundingBox()
        assert.ok(initial.width < bounds.width && initial.height < bounds.height)
        const dock = reader.getByRole('group', { name: 'Canvas controls' })
        const dockBounds = await dock.boundingBox()
        assert.ok(Math.abs(dockBounds.x + dockBounds.width / 2 - bounds.x - bounds.width / 2) <= 1)
        assert.ok(dockBounds.y + dockBounds.height < bounds.y + bounds.height)
        assert.ok(initial.y + initial.height <= dockBounds.y - 15, 'Fit keeps the board clear of the floating controls')
        if (reader === share) {
          const pan = await dock.getByRole('button', { name: 'Pan', exact: true }).boundingBox()
          assert.ok(pan.width >= 44 && pan.height >= 44)
          await assertShareCanvasHeight(bounds)
        }
        if (reader === workspace) {
          const section = await reader.getByRole('region', { name: 'Rangka content', exact: true }).boundingBox()
          assert.ok(Math.abs(bounds.x - section.x) < 1 && Math.abs(bounds.width - section.width) < 1)
          assert.ok(Math.abs(bounds.y + bounds.height - reader.viewportSize().height) <= 2)
        }
        // Playwright's locator click adds the iframe offset but does not scale
        // the coordinates inside a transformed frame.
        const point = (rect, x, y) => ({
          x: rect.x + x * rect.width / controlPosition.size[0],
          y: rect.y + y * rect.height / controlPosition.size[1],
        })
        const center = point(initial, controlPosition.x, controlPosition.y)
        const waitForFrame = (axis, comparison, value) => reader.waitForFunction(
          ({ axis, comparison, value }) => {
            const rect = document.querySelector('[aria-label="Rangka canvas"] iframe')?.getBoundingClientRect()
            return rect && (comparison === 'above' ? rect[axis] > value : rect[axis] < value)
          },
          { axis, comparison, value },
          { timeout: 4000 },
        )
        const waitForClicks = (count) => inner.waitForFunction(
          clicks => document.getElementById('board-control').dataset.clicks === clicks,
          String(count),
          { timeout: 4000 },
        )
        const handSurface = canvas.locator('.canvas-pan-surface')
        await reader.mouse.move(center.x, center.y)
        await settleBoard()
        await reader.keyboard.down('Space')
        await handSurface.waitFor({ state: 'visible', timeout: 4000 })
        await reader.keyboard.up('Space')
        await handSurface.waitFor({ state: 'hidden', timeout: 4000 })
        // The compositor must drop the hand surface from hit testing.
        await settleBoard()
        await reader.mouse.move(center.x + 1, center.y)
        await reader.mouse.click(center.x, center.y)
        await assert.doesNotReject(() => waitForClicks(1), `Canvas content is clickable at ${path}`)

        // Wheel zoom works over content while the hand tool is off. The point
        // just left of the control stays under the pointer across the zoom.
        await reader.mouse.move(center.x - 24, center.y)
        await reader.keyboard.down('Control')
        await reader.mouse.wheel(0, -100)
        await reader.keyboard.up('Control')
        await waitForFrame('width', 'above', initial.width + 10)
        const zoomed = await frame.boundingBox()
        const anchor = (center.x - 24 - initial.x) / initial.width
        assert.ok(Math.abs(zoomed.x + zoomed.width * anchor - (center.x - 24)) <= 2)

        // Focus the board without focusing a control, then start Space-drag
        // directly over the button. It must pan without activating the button.
        await settleBoard()
        const zoomedControl = point(zoomed, controlPosition.x, controlPosition.y)
        await reader.mouse.click(zoomedControl.x, zoomedControl.y - 23)
        await reader.keyboard.down('Space')
        await handSurface.waitFor({ state: 'visible', timeout: 4000 })
        await settleBoard()
        await reader.mouse.move(zoomedControl.x, zoomedControl.y)
        await reader.mouse.down()
        await reader.mouse.move(zoomedControl.x + 36, zoomedControl.y + 18, { steps: 6 })
        await reader.mouse.up()
        await reader.keyboard.up('Space')
        await waitForFrame('x', 'above', zoomed.x + 34)
        const panned = await frame.boundingBox()
        assert.ok(Math.abs(panned.x - zoomed.x - 36) <= 2)
        assert.ok(Math.abs(panned.y - zoomed.y - 18) <= 2)
        assert.equal(await control.getAttribute('data-clicks'), '1', 'Space-drag must not click the report')
        await settleBoard()
        const movedControl = point(panned, controlPosition.x, controlPosition.y)
        await reader.mouse.click(movedControl.x, movedControl.y)
        await assert.doesNotReject(() => waitForClicks(2), 'Releasing Space restores clicks immediately')

        await control.press('Space')
        await assert.doesNotReject(() => waitForClicks(3), 'Space still activates a focused button')
        await input.press('Space')
        await input.press('h')
        assert.equal(await input.inputValue(), ' h')
        assert.equal(await reader.getByRole('button', { name: 'Pan', exact: true }).getAttribute('aria-pressed'), 'false')

        await canvas.press('Shift+Digit1')
        const refit = await frame.boundingBox()
        assert.ok(Math.abs(refit.x - initial.x) < 1 && Math.abs(refit.width - initial.width) < 1)
        await settleBoard()
        const panel = point(initial, 1200, 610)
        await reader.mouse.move(panel.x, panel.y)
        await reader.mouse.wheel(0, 82)
        await inner.waitForFunction(() => document.getElementById('scroll-panel').scrollTop > 0, undefined, { timeout: 4000 })
        assert.equal((await frame.boundingBox()).y, initial.y, 'Wheel scroll over a panel stays in the panel')
        await reader.mouse.move(center.x - 40, center.y)
        await reader.mouse.wheel(24, 32)
        await waitForFrame('x', 'below', initial.x - 15)
        const wheelPan = await frame.boundingBox()
        assert.ok(Math.abs(wheelPan.y - initial.y + 32) <= 2)

        if (reader === share) {
          await canvas.press('0')
          await settleBoard()
          const y = Math.round(center.y)
          const x = Math.round(center.x) + 25
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart', touchPoints: [{ x: x - 25, y, id: 0 }, { x: x + 25, y, id: 1 }],
          })
          for (const [left, right, down] of [[28, 31, 2], [32, 37, 4], [36, 44, 6]]) {
            await touch.send('Input.dispatchTouchEvent', {
              type: 'touchMove', touchPoints: [{ x: x - left, y: y + down, id: 0 }, { x: x + right, y: y + down, id: 1 }],
            })
            await settleBoard()
          }
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
          await waitForFrame('width', 'above', initial.width * 1.4)
          const pinched = await frame.boundingBox()
          const touchAnchor = point(pinched, (x - initial.x) * 1920 / initial.width, (y - initial.y) * 1080 / initial.height)
          assert.ok(Math.abs(touchAnchor.x - x - 4) <= 2)
          assert.ok(Math.abs(touchAnchor.y - y - 6) <= 2)
          assert.equal(await control.getAttribute('data-clicks'), '3', 'Pinching does not activate controls')
          await canvas.press('0')
          await settleBoard()
          await reader.touchscreen.tap(center.x, center.y)
          await assert.doesNotReject(() => waitForClicks(4), 'A normal tap still activates the report control')
        }

        await canvas.press('0')
        await reader.getByRole('button', { name: 'Zoom in', exact: true }).click()
        assert.ok((await frame.boundingBox()).width > initial.width)
        const zoomOptions = dock.getByRole('button', { name: /^Zoom options/ })
        const zoomMenu = reader.getByRole('menu')
        await zoomOptions.press('Enter')
        const menuBounds = await zoomMenu.boundingBox()
        assert.ok(menuBounds.y + menuBounds.height < dockBounds.y, 'The zoom menu opens above the dock')
        await reader.keyboard.press('Escape')
        assert.equal(await zoomOptions.evaluate(button => button === document.activeElement), true)
        await zoomOptions.click()
        await zoomMenu.getByRole('menuitem', { name: '200%', exact: true }).click()
        assert.equal((await frame.boundingBox()).width, 3840)
        await zoomOptions.click()
        await zoomMenu.getByRole('menuitem', { name: '100% (actual size)', exact: true }).click()
        const fullSize = await frame.boundingBox()
        assert.equal(fullSize.width, 1920)
        assert.equal(fullSize.height, 1080)

        await reader.getByRole('button', { name: 'Pan', exact: true }).click()
        await reader.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        await reader.mouse.down()
        await reader.mouse.move(bounds.x + bounds.width / 2 + 48, bounds.y + bounds.height / 2 + 24)
        await reader.mouse.up()
        assert.ok((await frame.boundingBox()).x >= fullSize.x + 47)
        await reader.keyboard.down('Control')
        await reader.mouse.wheel(0, -100)
        await reader.keyboard.up('Control')
        await reader.waitForFunction(() => document.querySelector('[aria-label="Rangka canvas"] iframe')?.getBoundingClientRect().width > 1920)
        await canvas.press('0')
        const fitted = await frame.boundingBox()
        assert.ok(Math.abs(fitted.x - initial.x) < 1 && Math.abs(fitted.width - initial.width) < 1)
        const handTool = reader.getByRole('button', { name: 'Pan', exact: true })
        await handTool.press('Escape')
        assert.equal(await handTool.getAttribute('aria-pressed'), 'false')
        await canvas.press('h')
        assert.equal(await handTool.getAttribute('aria-pressed'), 'true')
        await reader.keyboard.press('Escape')
        assert.equal(await handTool.getAttribute('aria-pressed'), 'false')
        if (checkLoading) {
          const beforeKey = await frame.boundingBox()
          await inner.evaluate(() => {
            const meta = document.createElement('meta')
            meta.name = 'serangkai-canvas-keys'
            meta.content = 'none'
            document.head.append(meta)
            document.body.tabIndex = -1
            document.body.focus()
            document.addEventListener('keydown', (event) => {
              if (event.key === 'ArrowRight') document.body.dataset.advanced = 'true'
            })
          })
          await reader.keyboard.press('ArrowRight')
          await inner.waitForFunction(() => document.body.dataset.advanced === 'true')
          await settleBoard()
          assert.equal((await frame.boundingBox()).x, beforeKey.x, 'The authored key does not also pan the canvas')
          await canvas.press('ArrowRight')
          assert.ok((await frame.boundingBox()).x < beforeKey.x, 'Viewer shortcuts work when the viewport has focus')
          await canvas.press('0')
        }
        if (reader === share) {
          const portrait = share.viewportSize()
          await share.setViewportSize({ width: 900, height: 350 })
          await settleBoard()
          await assertShareCanvasHeight(await canvas.boundingBox())
          await share.setViewportSize(portrait)
        }
      }
    }
  } finally {
    await Promise.all([owner.close(), guest.close()])
  }
})

test('long HTML previews size to the document and scroll with the page', async () => {
  const rangkaId = await page.evaluate(async () => {
    const paragraphs = Array.from({ length: 80 }, (_, index) => `<p>Paragraph ${index + 1} — the preview should grow to fit this document.</p>`).join('')
    const content = `<!doctype html><html><head><title>Long preview</title></head><body><h1>Long preview</h1>${paragraphs}</body></html>`
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Long preview rangka', type: 'html', content }),
    })
    return (await res.json()).rangka.id
  })

  await page.goto(`${base}/rangka/${rangkaId}`)
  await page.locator('section[aria-label="Rangka content"] iframe').waitFor({ timeout: 15000 })
  // The injected bridge reports after layout; wait for the frame to outgrow 70vh.
  await page.waitForFunction(() => {
    const frame = document.querySelector('section[aria-label="Rangka content"] iframe')
    return !!frame && frame.getBoundingClientRect().height > window.innerHeight
  }, undefined, { timeout: 15000 })

  const previewFrame = page.frames().find(frame => frame.url().includes('/preview'))
  assert.ok(previewFrame, 'the preview frame must be available')
  let inner
  for (let attempt = 0; attempt < 30; attempt++) {
    inner = await previewFrame.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      hasBridge: !!document.querySelector('script[data-serangkai-preview-height]'),
    }))
    if (inner.scrollHeight <= inner.clientHeight + 1) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(inner.hasBridge, true)
  assert.ok(inner.scrollHeight <= inner.clientHeight + 1, `the frame must not scroll: ${inner.scrollHeight} > ${inner.clientHeight}`)

  const layout = await page.evaluate(() => {
    const section = document.querySelector('section[aria-label="Rangka content"]')
    const frame = section?.querySelector('iframe')
    const content = frame?.parentElement
    const rect = (element) => {
      const bounds = element.getBoundingClientRect()
      return { left: Math.round(bounds.left), right: Math.round(bounds.right), top: Math.round(bounds.top), bottom: Math.round(bounds.bottom), height: Math.round(bounds.height) }
    }
    return {
      viewport: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      section: section ? { ...rect(section), paddingBottom: parseFloat(getComputedStyle(section).paddingBottom) } : null,
      content: content ? rect(content) : null,
      frame: frame ? { ...rect(frame), border: getComputedStyle(frame).borderTopWidth } : null,
    }
  })

  assert.ok(layout.frame, 'the HTML preview iframe must render')
  assert.equal(layout.frame.border, '0px')
  assert.equal(layout.frame.left, layout.section.left)
  assert.equal(layout.frame.right, layout.section.right)
  assert.ok(layout.frame.height > layout.viewport, `frame height ${layout.frame.height}`)
  // The content ends with the document plus its own bottom padding.
  assert.ok(Math.abs(layout.section.bottom - layout.frame.bottom - layout.section.paddingBottom) <= 2, `section bottom ${layout.section.bottom} vs frame ${layout.frame.bottom}`)
  assert.ok(layout.section.height < layout.frame.height + 120, `section height ${layout.section.height}`)
  // The main page owns the scroll.
  assert.ok(layout.pageHeight > layout.frame.height, `page ${layout.pageHeight} vs frame ${layout.frame.height}`)

  // A short document keeps the 70vh floor instead of collapsing.
  const shortId = await page.evaluate(async () => {
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Short preview rangka', type: 'html', content: '<!doctype html><html><head><title>Short</title></head><body><h1>Short</h1></body></html>' }),
    })
    return (await res.json()).rangka.id
  })
  await page.goto(`${base}/rangka/${shortId}`)
  await page.locator('section[aria-label="Rangka content"] iframe').waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)
  const short = await page.evaluate(() => {
    const frame = document.querySelector('section[aria-label="Rangka content"] iframe')
    return { height: Math.round(frame.getBoundingClientRect().height), viewport: window.innerHeight }
  })
  assert.ok(Math.abs(short.height - short.viewport * 0.7) <= 3, `short frame height ${short.height} at ${short.viewport}`)
})

test('small HTML growth does not leave the preview scrollable', async () => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const rangkaId = await page.evaluate(async () => {
    const content = '<!doctype html><html><head><title>Growing preview</title>'
      + '<style>body{margin:0}#grow{height:600px;background:#eef}</style></head>'
      + '<body><div id="grow"></div><script>setTimeout(() => { document.getElementById("grow").style.height = "601px" }, 700)</script></body></html>'
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Growing preview rangka', type: 'html', content }),
    })
    return (await res.json()).rangka.id
  })

  await page.goto(`${base}/rangka/${rangkaId}`)
  await page.locator('section[aria-label="Rangka content"] iframe').waitFor({ timeout: 15000 })
  const previewFrame = page.frames().find(frame => frame.url().includes('/preview'))
  assert.ok(previewFrame, 'the preview frame must be available')
  await previewFrame.waitForFunction(() => {
    const box = document.getElementById('grow')
    return !!box && box.getBoundingClientRect().height >= 601
  }, undefined, { timeout: 5000 })
  // Let the bridge report the 1px growth and the parent decide what to do.
  await page.waitForTimeout(1200)

  const inner = await previewFrame.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    boxHeight: document.getElementById('grow').getBoundingClientRect().height,
  }))
  assert.equal(inner.boxHeight, 601)
  // A 1px overflow still makes the iframe a scroll target: macOS overlay
  // scrollbars then scroll the document before the page. The frame needs slack.
  assert.ok(inner.scrollHeight <= inner.clientHeight, `preview must not scroll: ${inner.scrollHeight} > ${inner.clientHeight}`)
})

test('viewport-sized HTML previews do not grow in a feedback loop', async () => {
  const rangkaId = await page.evaluate(async () => {
    const content = '<!doctype html><html><head><style>html,body{height:100%;margin:0}main{height:100vh;display:grid;place-items:center}</style></head><body><main><h1>Slide</h1></main></body></html>'
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Viewport-sized rangka', type: 'html', content }),
    })
    return (await res.json()).rangka.id
  })

  await page.goto(`${base}/rangka/${rangkaId}`)
  await page.locator('section[aria-label="Rangka content"] iframe').waitFor({ timeout: 15000 })
  const heights = []
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.waitForTimeout(350)
    heights.push(await page.evaluate(() => Math.round(document.querySelector('section[aria-label="Rangka content"] iframe').getBoundingClientRect().height)))
  }
  assert.ok(heights.every(height => Math.abs(height - heights[0]) <= 2), `heights ${heights.join(', ')}`)
  assert.ok(Math.abs(heights[0] - page.viewportSize().height * 0.7) <= 3, `frame height ${heights[0]}`)
})

test('read-only values offer a working copy button', async () => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })

  await page.goto(`${base}/agent`)
  await page.getByRole('button', { name: 'Copy setup prompt', exact: true }).click()
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^Connect to my Serangkai workspace over MCP\./)
  await page.getByRole('tab', { name: 'Manual setup', exact: true }).click()
  const mcpCopy = page.getByRole('button', { name: 'Copy MCP endpoint' })
  await assert.doesNotReject(() => mcpCopy.waitFor())
  await assert.doesNotReject(() => page.getByRole('button', { name: 'Copy REST endpoint' }).waitFor())
  await mcpCopy.click()
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /\/api\/mcp$/)
  // The control acknowledges the copy instead of staying silent.
  assert.equal(await page.getByRole('button', { name: 'Copied' }).count(), 1)
  await page.getByRole('button', { name: 'Copy starter prompt', exact: true }).click()
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^Create a Markdown rangka in Serangkai/)
})

test('shared HTML rangka open in the reader with the app chrome', async () => {
  const shareUrl = await page.evaluate(async () => {
    const html = '<!doctype html><html><head><title>Framed</title></head><body><h1>Frame content</h1></body></html>'
    const form = new FormData()
    form.append('file', new File([html], 'framed.html', { type: 'text/html' }), 'framed.html')
    form.append('title', 'framed')
    form.append('visibility', 'unlisted')
    const created = await fetch('/api/rangka/upload', { method: 'POST', body: form })
    const { rangka } = await created.json()
    const share = await fetch(`/api/rangka/${rangka.id}/share`, { method: 'POST' })
    return (await share.json()).url
  })

  // The generated link points at the reader; the raw delivery URL keeps its
  // key and is what frames and fetches use.
  assert.match(shareUrl, /\/share\//)
  const rawUrl = shareUrl.replace('/share/', '/api/share/')

  // Frames and fetches keep the raw document...
  const raw = await fetch(rawUrl)
  assert.equal(raw.status, 200)
  assert.match(raw.headers.get('content-type'), /text\/html/)

  // ...while a browser navigation lands on the reader. fetch() strips
  // `Sec-` headers by spec, so send this one over a raw socket.
  const nav = await new Promise((resolve, reject) => {
    const req = httpRequest(rawUrl, { headers: { 'sec-fetch-dest': 'document' } }, (res) => {
      res.resume()
      resolve({ status: res.statusCode, location: res.headers.location || '' })
    })
    req.on('error', reject)
    req.end()
  })
  assert.equal(nav.status, 302)
  assert.match(nav.location, /\/share\//)

  await page.goto(shareUrl)
  await assert.doesNotReject(() => page.locator('iframe').first().waitFor())
  assert.ok(await page.getByRole('link', { name: 'Serangkai home' }).isVisible())
  await assert.doesNotReject(() => page.frameLocator('iframe').getByText('Frame content').waitFor())

  const previewFrame = page.frames().find(frame => frame.url().includes('/api/share/'))
  assert.ok(previewFrame, 'the shared HTML frame must be available')
  let inner
  for (let attempt = 0; attempt < 30; attempt++) {
    inner = await previewFrame.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      hasBridge: !!document.querySelector('script[data-serangkai-preview-height]'),
    }))
    if (inner.hasBridge && inner.scrollHeight <= inner.clientHeight + 1) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(inner.hasBridge, true, 'public shares must inject the height bridge')
  assert.ok(inner.scrollHeight <= inner.clientHeight + 1, `the frame must not scroll: ${inner.scrollHeight} > ${inner.clientHeight}`)

  // The rangka is the page, not a card inside it: the header and footer are
  // the only chrome, the frame spans the width, and a short document still
  // fills the row so the footer closes the viewport.
  const layout = await page.evaluate(() => {
    const header = document.querySelector('header')
    const frame = document.querySelector('iframe')
    const footer = document.querySelector('footer')
    const rect = frame.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()
    return {
      headerPosition: getComputedStyle(header).position,
      headerBottom: header.getBoundingClientRect().bottom,
      frame: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      border: getComputedStyle(frame).borderTopWidth,
      title: document.querySelectorAll('main h1').length,
      footer: { text: footer.innerText, top: footerRect.top, bottom: footerRect.bottom },
      windowScrolls: document.documentElement.scrollHeight > innerHeight,
      viewport: { width: innerWidth, height: innerHeight },
    }
  })
  assert.equal(layout.headerPosition, 'sticky')
  assert.equal(layout.frame.x, 0)
  assert.equal(layout.frame.y, layout.headerBottom)
  assert.equal(Math.round(layout.frame.width), layout.viewport.width)
  assert.equal(layout.border, '0px')
  assert.equal(layout.title, 0)
  assert.match(layout.footer.text, /Shared from Serangkai/)
  // A short document does not add an outer scrollbar: the frame fills the
  // space between the header and footer.
  assert.equal(layout.windowScrolls, false)
  assert.ok(layout.frame.height > 0, `frame height ${layout.frame.height}`)
  assert.ok(Math.abs(layout.footer.bottom - layout.viewport.height) < 1, `footer bottom ${layout.footer.bottom}`)

  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(150)
  const scrolled = await page.evaluate(() => ({
    headerTop: document.querySelector('header').getBoundingClientRect().top,
    footerBottom: document.querySelector('footer').getBoundingClientRect().bottom,
    viewportHeight: innerHeight,
  }))
  assert.equal(scrolled.headerTop, 0)
  assert.ok(Math.abs(scrolled.footerBottom - scrolled.viewportHeight) < 1, `footer bottom ${scrolled.footerBottom}`)
})

test('shared document HTML grows with its content and keeps one scrollbar', async () => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const shareUrl = await page.evaluate(async () => {
    const paragraphs = Array.from({ length: 80 }, (_, index) => `<p>Paragraph ${index + 1} — the shared page should grow to fit this document.</p>`).join('')
    const html = `<!doctype html><html><head><title>Long share</title></head><body><h1>Long share</h1>${paragraphs}</body></html>`
    const created = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Long shared HTML', type: 'html', content: html, visibility: 'public' }),
    })
    const { rangka } = await created.json()
    const share = await fetch(`/api/rangka/${rangka.id}/share`, { method: 'POST' })
    return (await share.json()).url
  })

  await page.goto(shareUrl)
  await page.locator('iframe').waitFor({ timeout: 15000 })
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe')
    return !!frame && frame.getBoundingClientRect().height > window.innerHeight
  }, undefined, { timeout: 15000 })

  const previewFrame = page.frames().find(frame => frame.url().includes('/api/share/'))
  assert.ok(previewFrame, 'the shared HTML frame must be available')
  let inner
  for (let attempt = 0; attempt < 30; attempt++) {
    inner = await previewFrame.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }))
    if (inner.scrollHeight <= inner.clientHeight + 1) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(inner.scrollHeight <= inner.clientHeight + 1, `the frame must not scroll: ${inner.scrollHeight} > ${inner.clientHeight}`)

  const layout = await page.evaluate(() => {
    const header = document.querySelector('header')
    const frame = document.querySelector('iframe')
    const footer = document.querySelector('footer')
    const frameRect = frame.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()
    return {
      viewport: innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      frame: { top: frameRect.top, bottom: frameRect.bottom, height: frameRect.height },
      headerBottom: header.getBoundingClientRect().bottom,
      footerTop: footerRect.top,
    }
  })

  assert.equal(Math.round(layout.frame.top), Math.round(layout.headerBottom))
  assert.ok(layout.frame.height > layout.viewport, `frame height ${layout.frame.height}`)
  assert.ok(layout.footerTop >= layout.frame.bottom - 1, `footer top ${layout.footerTop} vs frame bottom ${layout.frame.bottom}`)
  // The page owns the only scrollbar; the footer follows the document.
  assert.ok(layout.pageHeight > layout.frame.height, `page ${layout.pageHeight} vs frame ${layout.frame.height}`)
})

test('viewport-sized shared HTML keeps a bounded frame with its own scroll', async () => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const shareUrl = await page.evaluate(async () => {
    const html = '<!doctype html><html><head><title>App share</title>'
      + '<meta name="serangkai-presentation" content="app">'
      + '<style>html,body{margin:0;height:100%}main{height:160vh;background:#eef}</style>'
      + '</head><body><main><h1>App</h1></main></body></html>'
    const created = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'App shared HTML', type: 'html', content: html, visibility: 'public' }),
    })
    const { rangka } = await created.json()
    const share = await fetch(`/api/rangka/${rangka.id}/share`, { method: 'POST' })
    return (await share.json()).url
  })

  await page.goto(shareUrl)
  await page.locator('iframe').waitFor({ timeout: 15000 })
  const heights = []
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.waitForTimeout(350)
    heights.push(await page.evaluate(() => Math.round(document.querySelector('iframe').getBoundingClientRect().height)))
  }
  assert.ok(heights.every(height => Math.abs(height - heights[0]) <= 2), `heights ${heights.join(', ')}`)

  const previewFrame = page.frames().find(frame => frame.url().includes('/api/share/'))
  assert.ok(previewFrame, 'the shared HTML frame must be available')
  const inner = await previewFrame.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }))
  // The app opts out of height reporting: the frame stays bounded and keeps
  // its own scrollbar instead of growing the outer page.
  assert.ok(inner.scrollHeight > inner.clientHeight, `app frame should scroll internally: ${inner.scrollHeight} <= ${inner.clientHeight}`)

  const layout = await page.evaluate(() => {
    const header = document.querySelector('header')
    const frame = document.querySelector('iframe')
    const footer = document.querySelector('footer')
    return {
      viewport: innerHeight,
      frameHeight: frame.getBoundingClientRect().height,
      frameTop: frame.getBoundingClientRect().top,
      headerBottom: header.getBoundingClientRect().bottom,
      footerBottom: footer.getBoundingClientRect().bottom,
      windowScrolls: document.documentElement.scrollHeight > innerHeight,
    }
  })
  assert.ok(layout.frameHeight < layout.viewport, `bounded frame height ${layout.frameHeight}`)
  assert.equal(Math.round(layout.frameTop), Math.round(layout.headerBottom))
  assert.equal(layout.windowScrolls, false)
  assert.ok(Math.abs(layout.footerBottom - layout.viewport) < 1, `footer bottom ${layout.footerBottom}`)
})

test('shared source files use the full page, with the footer at the end', async () => {
  const shareUrl = await page.evaluate(async () => {
    const content = JSON.stringify({
      project: 'Serangkai',
      items: Array.from({ length: 40 }, (_, index) => ({ id: index, name: `Item ${index}` })),
    }, null, 2)
    const created = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'source-full', type: 'json', content, visibility: 'unlisted' }),
    })
    const { rangka } = await created.json()
    const share = await fetch(`/api/rangka/${rangka.id}/share`, { method: 'POST' })
    return (await share.json()).url
  })

  await page.goto(shareUrl)
  await page.locator('.serangkai-shiki span').first().waitFor()
  const layout = await page.evaluate(() => {
    const header = document.querySelector('header')
    const footer = document.querySelector('footer')
    const pre = document.querySelector('pre')
    const rect = pre.getBoundingClientRect()
    return {
      headerBottom: header.getBoundingClientRect().bottom,
      footerTop: footer.getBoundingClientRect().top,
      pre: { top: rect.top, width: rect.width },
      title: document.querySelectorAll('main h1').length,
      windowScrolls: document.documentElement.scrollHeight > innerHeight,
      viewport: { width: innerWidth, height: innerHeight },
    }
  })

  // No title card, and the code spans the whole width instead of a 4xl column.
  assert.equal(layout.title, 0)
  assert.ok(layout.pre.width > layout.viewport.width * 0.9, `code width ${layout.pre.width} of ${layout.viewport.width}`)
  assert.ok(layout.pre.top >= layout.headerBottom)
  // The document scrolls normally and the footer sits after the code.
  assert.equal(layout.windowScrolls, true)
  assert.ok(layout.footerTop > layout.pre.top)

  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(150)
  const scrolled = await page.evaluate(() => ({
    headerTop: document.querySelector('header').getBoundingClientRect().top,
    footerBottom: document.querySelector('footer').getBoundingClientRect().bottom,
    viewportHeight: innerHeight,
  }))
  assert.equal(scrolled.headerTop, 0)
  assert.ok(Math.abs(scrolled.footerBottom - scrolled.viewportHeight) < 1, `footer bottom ${scrolled.footerBottom}`)
})

test('navigating from a public rangka to the workspace keeps the signed-in state', async () => {
  const slug = await page.evaluate(async () => {
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Public navigation check', type: 'markdown', content: '# Shared', visibility: 'public' }),
    })
    return (await res.json()).rangka.slug
  })

  await page.goto(`${base}/share/${slug}`)
  await page.getByRole('link', { name: 'Serangkai home' }).click()
  await page.waitForURL(`${base}/`)
  await assert.doesNotReject(() => page.getByRole('link', { name: 'Workspace', exact: true }).first().waitFor())
  assert.equal(await page.getByRole('banner').getByRole('link', { name: 'Log in' }).count(), 0)
  await assert.doesNotReject(() => page.getByRole('complementary', { name: 'Workspace sidebar' }).getByText(adminUsername, { exact: true }).waitFor())
})

test('anonymous readers still see the login action after leaving a share link', async () => {
  const slug = await page.evaluate(async () => {
    const res = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Anonymous navigation check', type: 'markdown', content: '# Public', visibility: 'public' }),
    })
    return (await res.json()).rangka.slug
  })

  const context = await browser.newContext()
  const anon = await context.newPage()
  try {
    await anon.goto(`${base}/share/${slug}`)
    await anon.getByRole('link', { name: 'Serangkai home' }).click()
    await anon.waitForURL(`${base}/auth/login`)
    await anon.getByRole('heading', { name: 'Log in to Serangkai' }).waitFor()
    assert.equal(await anon.getByRole('link', { name: 'Workspace', exact: true }).count(), 0)
  } finally {
    await context.close()
  }
})

test('dark mode sets a dark color scheme and canvas for scrollbars and overscroll', async () => {
  const context = await browser.newContext({ colorScheme: 'dark' })
  const dark = await context.newPage()
  try {
    await dark.goto(`${base}/`)
    await dark.waitForTimeout(1200)
    const style = await dark.evaluate(() => ({
      dark: document.documentElement.classList.contains('dark'),
      scheme: getComputedStyle(document.documentElement).colorScheme,
      htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
    }))
    assert.equal(style.dark, true, 'the color-mode class must be applied')
    assert.equal(style.scheme, 'dark', 'native scrollbars/controls must use the dark scheme')
    assert.notEqual(style.htmlBackground, 'rgba(0, 0, 0, 0)', 'the canvas must be painted')
    assert.notEqual(style.htmlBackground, 'rgb(255, 255, 255)', 'the canvas must not stay white')
    assert.equal(style.bodyBackground, style.htmlBackground)
  } finally {
    await context.close()
  }
})

test('unknown pages render the custom 404 page and recover', async () => {
  const response = await page.goto(`${base}/definitely-not-a-page`)
  assert.equal(response?.status(), 404)
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'This page is off the map.' }).waitFor())
  assert.equal(await page.getByText('Error 404 · Not found').count(), 1)

  await page.getByRole('button', { name: 'Back to workspace' }).click()
  await page.waitForURL(/\/(?:workspace)?$/)
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Rangka', exact: true }).waitFor())
  assert.equal(await page.getByRole('heading', { name: 'This page is off the map.' }).count(), 0)
  assert.equal(await page.title(), 'Workspace · Serangkai')
})

test('anonymous 404 recovery returns to owner login and its title', async () => {
  const context = await browser.newContext()
  const anon = await context.newPage()
  try {
    await anon.goto(`${base}/definitely-not-a-page`)
    await anon.getByRole('heading', { name: 'This page is off the map.' }).waitFor()
    await anon.getByRole('button', { name: 'Back to home' }).click()
    await anon.waitForURL(`${base}/auth/login`)
    await anon.getByRole('heading', { name: 'Log in to Serangkai' }).waitFor()
    assert.equal(await anon.title(), 'Log in · Serangkai')
  } finally {
    await context.close()
  }
})

test('missing rangka show the custom error page and recover', async () => {
  await page.goto(`${base}/rangka/definitely-not-an-rangka`)
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'This page is off the map.' }).waitFor())
  assert.match(await page.getByText('Error code').innerText(), /404/)

  await page.getByRole('button', { name: 'Back to workspace' }).click()
  await page.waitForURL(/\/(?:workspace)?$/)
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Rangka', exact: true }).waitFor())
  assert.equal(await page.getByRole('heading', { name: 'This page is off the map.' }).count(), 0)
})

test('workspace load errors are shown inline, recover, and never block navigation', async () => {
  const rangkaFilter = url => url.pathname === '/api/workspace'
  const failRangka = route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ statusCode: 503, statusMessage: 'Service Unavailable', message: 'Temporarily unavailable' }),
  })

  await page.route(rangkaFilter, failRangka)
  try {
    await page.goto(`${base}/workspace`)
    await assert.doesNotReject(() => page.getByText('Could not load the workspace').waitFor())
    assert.match(await page.getByRole('alert').innerText(), /Temporarily unavailable/)
    // The app shell stays usable while the page is in its error state.
    await page.getByRole('link', { name: 'Agents', exact: true }).first().click()
    await page.waitForURL('**/agent')
    await assert.doesNotReject(() => page.getByRole('heading', { name: 'Connect an agent' }).waitFor())
    await page.getByRole('link', { name: 'Workspace', exact: true }).first().click()
    await page.waitForURL(/\/(?:workspace)?$/)
    await assert.doesNotReject(() => page.getByText('Could not load the workspace').waitFor())

    await page.unroute(rangkaFilter, failRangka)
    await page.getByRole('button', { name: 'Try again' }).click()
    await assert.doesNotReject(() => page.getByRole('button', { name: 'All rangka' }).waitFor())
    assert.equal(await page.getByText('Could not load the workspace').count(), 0)
  } finally {
    await page.unroute(rangkaFilter, failRangka)
  }

  // A boundary failure must clear on the next route, not cover every page.
  await page.goto(`${base}/workspace`)
  await page.getByRole('heading', { name: 'Rangka', exact: true }).waitFor()
  assert.equal(await triggerPageError(page), true)
  await assert.doesNotReject(() => page.getByText('This page hit an unexpected error').waitFor())
  await page.getByRole('link', { name: 'Agents', exact: true }).first().click()
  await page.waitForURL('**/agent')
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Connect an agent' }).waitFor())
  assert.equal(await page.getByText('This page hit an unexpected error').count(), 0)
})

test('a page component error can be retried without losing the app shell', async () => {
  await page.goto(`${base}/workspace`)
  await page.getByRole('heading', { name: 'Rangka', exact: true }).waitFor()
  assert.equal(await triggerPageError(page), true)
  await assert.doesNotReject(() => page.getByText('This page hit an unexpected error').waitFor())

  await page.getByRole('button', { name: 'Try again' }).click()
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Rangka', exact: true }).waitFor())
  assert.equal(await page.getByText('This page hit an unexpected error').count(), 0)
})

/**
 * The boundary only reacts to descendant component failures, so a test has to
 * inject one. Find the boundary instance in the Vue tree and call its
 * errorCaptured hook instead of adding a production-only failure route.
 */
function triggerPageError(target) {
  return target.evaluate(() => {
    const root = document.querySelector('#__nuxt')
    const seen = new Set()
    let boundary
    const visit = (vnode, depth) => {
      if (!vnode || typeof vnode !== 'object' || seen.has(vnode) || depth > 80 || boundary) return
      seen.add(vnode)
      const instance = vnode.component
      if (instance) {
        if (instance.type?.name === 'NuxtErrorBoundary' && instance.ec?.length) {
          boundary = instance
          return
        }
        visit(instance.subTree, depth + 1)
      }
      if (Array.isArray(vnode.children)) for (const child of vnode.children) visit(child, depth + 1)
      if (vnode.suspense) {
        visit(vnode.suspense.activeBranch, depth + 1)
        visit(vnode.suspense.pendingBranch, depth + 1)
      }
      if (vnode.ssContent) visit(vnode.ssContent, depth + 1)
    }
    visit(root?._vnode?.component?.subTree, 0)
    if (!boundary) return false
    boundary.ec[0](new Error('Simulated page failure'))
    return true
  })
}

test('share errors use the error design and short share pages keep the footer at the bottom', async () => {
  const response = await page.goto(`${base}/share/definitely-not-a-share`)
  assert.equal(response?.status(), 404)
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'This shared rangka is off the map.' }).waitFor())
  assert.equal(await page.getByText('This link is invalid or the rangka is no longer shared.').count(), 1)
  assert.equal(await page.locator('.serangkai-error-doodle').count(), 1)

  const footerPosition = () => page.locator('footer').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { bottom: Math.round(rect.bottom), viewport: window.innerHeight }
  })

  let footer = await footerPosition()
  assert.ok(Math.abs(footer.bottom - footer.viewport) <= 2, 'the error page footer must sit at the viewport bottom')

  const sharePath = await page.evaluate(async () => {
    const created = await fetch('/api/rangka', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Short share', type: 'markdown', content: '# Short share', visibility: 'public' }),
    })
    const { rangka } = await created.json()
    return `/share/${rangka.slug}`
  })

  await page.goto(`${base}${sharePath}`)
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Short share' }).waitFor())
  footer = await footerPosition()
  assert.ok(Math.abs(footer.bottom - footer.viewport) <= 2, 'a short share footer must sit at the viewport bottom')
})

test('the appearance theme applies instantly and persists across reloads', async () => {
  const themePage = await browser.newPage()
  try {
    await themePage.request.post(`${base}/api/auth/login`, {
      data: { username: adminUsername, password: adminPassword },
    })
    await themePage.goto(`${base}/settings`, { waitUntil: 'networkidle' })
    await assert.doesNotReject(() => themePage.getByRole('heading', { name: 'Appearance' }).waitFor())
    assert.equal(await themePage.locator('html').getAttribute('data-serangkai-theme'), 'serangkai')

    const rosePine = themePage.getByRole('radio', { name: /Rosé Pine/ })
    await rosePine.click()
    await themePage.waitForFunction(() => document.documentElement.dataset.serangkaiTheme === 'rose-pine')

    const themed = await themePage.evaluate(() => ({
      dark: document.documentElement.classList.contains('dark'),
      background: getComputedStyle(document.body).backgroundColor,
      canvas: getComputedStyle(document.documentElement).getPropertyValue('--selaras-surface-canvas').trim(),
    }))
    assert.equal(themed.canvas, themed.dark ? '#191724' : '#faf4ed')
    assert.equal(themed.background, themed.dark ? 'rgb(25, 23, 36)' : 'rgb(250, 244, 237)')

    // Both directions must update immediately; a stale cookie would leave one behind.
    await themePage.getByRole('radio', { name: /^Serangkai/ }).click()
    await themePage.waitForFunction(() => document.documentElement.dataset.serangkaiTheme === 'serangkai')
    await rosePine.click()
    await themePage.waitForFunction(() => document.documentElement.dataset.serangkaiTheme === 'rose-pine')

    // The cookie is read during SSR, so a reload keeps the attribute without a flash.
    await themePage.reload({ waitUntil: 'networkidle' })
    assert.equal(await themePage.locator('html').getAttribute('data-serangkai-theme'), 'rose-pine')
    assert.equal(await rosePine.getAttribute('aria-checked'), 'true')
    const serverHtml = await (await themePage.request.get(`${base}/settings`)).text()
    assert.match(serverHtml, /data-serangkai-theme="rose-pine"/)

    // TanStack Charts reads its categorical palette from --ts-chart-*; the
    // rendered SVG must pick up Rosé Pine's iris instead of the fallback blue.
    const chartRangkaId = await themePage.evaluate(async () => {
      const res = await fetch('/api/rangka', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Theme chart check',
          type: 'markdown',
          content: '```chart\n{"type":"bar","data":[{"label":"A","value":1}]}\n```',
        }),
      })
      return (await res.json()).rangka.id
    })
    await themePage.goto(`${base}/rangka/${chartRangkaId}`, { waitUntil: 'networkidle' })
    await themePage.locator('.ts-chart-host svg').first().waitFor()
    const chartFills = await themePage.locator('.ts-chart-host svg rect').evaluateAll(rects => rects.map(rect => getComputedStyle(rect).fill))
    assert.ok(
      chartFills.includes(themed.dark ? 'rgb(196, 167, 231)' : 'rgb(144, 122, 169)'),
      `expected the Rosé Pine chart palette, got ${chartFills.join(', ')}`,
    )

    // The error page renders outside the normal app tree; the plugin must still
    // publish the theme there.
    await themePage.goto(`${base}/definitely-not-a-page`, { waitUntil: 'networkidle' })
    assert.equal(await themePage.locator('html').getAttribute('data-serangkai-theme'), 'rose-pine')
  } finally {
    await themePage.close()
  }
})

test('workspace stays usable on narrow screens with long names and pagination', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 } })
  const mobile = await context.newPage()
  try {
    await mobile.goto(`${base}/auth/login`)
    await mobile.getByLabel('Username').fill(adminUsername)
    await mobile.getByLabel('Password').fill(adminPassword)
    await mobile.waitForFunction(hydrated)
    await mobile.getByRole('button', { name: 'Log in' }).click()
    await mobile.waitForURL(/\/(?:workspace)?$/)
    const name = 'A-very-long-folder-name-without-any-spaces-to-break-the-layout'
    const folders = Array.from({ length: 12 }, (_, i) => ({ id: `folder-${i}`, name: i === 11 ? name : `Folder ${i}`, parentId: i ? `folder-${i - 1}` : null, path: `/${i === 11 ? name : `Folder ${i}`}` }))
    await mobile.route(url => url.pathname === '/api/workspace', route => route.fulfill({
      json: { folders, counts: [{ folderId: 'folder-11', value: 26 }], total: 26, page: Number(new URL(route.request().url()).searchParams.get('page') || 1), pageSize: 25, rangka: [{ id: 'mobile-test', title: 'A very long rangka title that should stay readable alongside its visibility badge and preview', type: 'markdown', visibility: 'unlisted', folderId: 'folder-11', updatedAt: new Date().toISOString(), shareUrl: '/share/example' }] },
    }))
    await mobile.reload()
    await mobile.getByRole('link', { name: /^A very long rangka title/ }).waitFor()
    for (const width of [320, 375, 768]) {
      await mobile.setViewportSize({ width, height: 720 })
      const sizes = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
      assert.ok(sizes.content <= sizes.viewport, `horizontal overflow at ${width}px: ${JSON.stringify(sizes)}`)
      assert.equal(await mobile.getByRole('button', { name: 'Next', exact: true }).isVisible(), true)
      assert.equal(await mobile.getByRole('link', { name: /Preview A very long rangka/ }).isVisible(), true)
      assert.equal(await mobile.getByRole('button', { name: 'Browse folders' }).isVisible(), true)
    }
    await mobile.setViewportSize({ width: 320, height: 720 })
    await mobile.getByRole('button', { name: 'Next', exact: true }).click()
    await mobile.getByText('Page 2 of 2').waitFor()
    await mobile.getByRole('button', { name: 'Browse folders' }).click()
    const foldersPanel = mobile.getByRole('dialog', { name: 'Navigation' })
    await foldersPanel.waitFor()
    await mobile.waitForFunction(() => { const panel = document.querySelector('[role=dialog]'); return panel && Math.abs(panel.getBoundingClientRect().left) < 2 })
    for (const folder of folders.slice(0, -1)) {
      await foldersPanel.getByRole('treeitem').filter({ has: mobile.getByText(folder.name, { exact: true }) }).locator('[data-folder-toggle]').click()
    }
    await foldersPanel.getByRole('button', { name: `Actions for ${name}` }).click()
    await mobile.getByRole('button', { name: 'Rename', exact: true }).click()
    await mobile.getByRole('dialog', { name: 'Rename folder' }).waitFor()
    await mobile.getByRole('dialog', { name: 'Rename folder' }).getByRole('button', { name: 'Cancel' }).click()
    await mobile.getByRole('button', { name: 'Browse folders' }).click()
    await foldersPanel.waitFor()
    await foldersPanel.getByRole('treeitem').filter({ has: mobile.getByText(name, { exact: true }) }).click()
    await foldersPanel.waitFor({ state: 'hidden' })
    await mobile.getByRole('heading', { name, exact: true }).waitFor()
    const sizes = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
    assert.ok(sizes.content <= sizes.viewport, `selected folder causes horizontal overflow: ${JSON.stringify(sizes)}`)
  } finally {
    await context.close()
  }
})

test('mobile navigation drawer opens from the left and closes after navigation', async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 720 } })
  const mobile = await context.newPage()
  try {
    await mobile.goto(`${base}/auth/login`)
    await mobile.getByLabel('Username').fill(adminUsername)
    await mobile.getByLabel('Password').fill(adminPassword)
    await mobile.waitForFunction(hydrated)
    await mobile.getByRole('button', { name: 'Log in' }).click()
    await mobile.waitForURL(/\/(?:workspace)?$/)
    const trigger = mobile.getByRole('button', { name: 'Open navigation', exact: true })
    await trigger.waitFor()
    assert.equal(await mobile.getByRole('navigation', { name: 'Workspace sections' }).count(), 0)
    await trigger.click()
    const dialog = mobile.getByRole('dialog', { name: 'Navigation' })
    await dialog.waitFor()
    await dialog.getByText(adminUsername, { exact: true }).waitFor()
    await dialog.getByRole('button', { name: `Account menu for ${adminUsername}`, exact: true }).waitFor()
    await mobile.waitForFunction(() => { const panel = document.querySelector('[role=dialog]'); if (!panel) return false; return Math.abs(panel.getBoundingClientRect().left) < 2 })
    await dialog.getByRole('link', { name: 'Agents', exact: true }).click()
    await mobile.waitForURL('**/agent')
    await dialog.waitFor({ state: 'hidden' })
    await trigger.click()
    await dialog.waitFor()
    await mobile.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    await mobile.setViewportSize({ width: 1280, height: 720 })
    assert.equal(await trigger.isVisible(), false)
    await mobile.getByRole('complementary', { name: 'Workspace sidebar' }).getByText(adminUsername, { exact: true }).waitFor()
    await mobile.getByRole('complementary', { name: 'Workspace sidebar' }).getByRole('button', { name: `Account menu for ${adminUsername}`, exact: true }).waitFor()
    await mobile.getByRole('link', { name: 'Workspace', exact: true }).first().waitFor()
  } finally {
    await context.close()
  }
})

test('agent connection reference fits narrow viewports and keeps copy controls available', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 } })
  const mobile = await context.newPage()
  try {
    await mobile.goto(`${base}/agent`)
    await mobile.getByLabel('Username').fill(adminUsername)
    await mobile.getByLabel('Password').fill(adminPassword)
    await mobile.waitForFunction(hydrated)
    await mobile.getByRole('button', { name: 'Log in', exact: true }).click()
    await mobile.getByRole('heading', { name: 'Connect an agent' }).waitFor()
    await mobile.getByRole('tab', { name: 'Manual setup', exact: true }).click()
    for (const width of [320, 375, 768, 1280]) {
      await mobile.setViewportSize({ width, height: 720 })
      const sizes = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
      assert.ok(sizes.content <= sizes.viewport, `agent page overflows at ${width}px: ${JSON.stringify(sizes)}`)
      assert.equal(await mobile.getByRole('button', { name: 'Copy MCP endpoint' }).isVisible(), true)
      assert.equal(await mobile.getByRole('button', { name: 'Copy REST endpoint' }).isVisible(), true)
      assert.match(await mobile.getByRole('textbox', { name: 'MCP endpoint' }).inputValue(), /\/api\/mcp$/)
      if (width === 320 || width === 1280) await mobile.screenshot({ path: `/tmp/serangkai-agent-setup-${width}.png` })
    }
    await mobile.setViewportSize({ width: 320, height: 720 })
    await mobile.getByRole('tab', { name: 'API token', exact: true }).click()
    await mobile.getByRole('heading', { name: 'MCP client configuration' }).waitFor()
    const intro = mobile.getByText('For clients that support Streamable HTTP MCP servers. Replace the token with one you just created.')
    const snippet = intro.locator('xpath=following-sibling::*[1]')
    const [introBox, snippetBox] = await Promise.all([intro.boundingBox(), snippet.boundingBox()])
    assert.ok(introBox && snippetBox && snippetBox.y > introBox.y + introBox.height + 10, 'MCP snippet should have space below its description')
    await mobile.getByRole('tab', { name: 'REST API', exact: true }).click()
    await mobile.getByRole('heading', { name: 'REST examples', exact: true }).waitFor()
    assert.match(await mobile.getByRole('tabpanel', { name: 'REST API', exact: true }).innerText(), /\/api\/rangka/)
    await mobile.getByRole('tab', { name: 'Browser sign-in', exact: true }).click()
    await mobile.getByRole('heading', { name: 'Connect with browser sign-in', exact: true }).waitFor()
    await mobile.getByRole('button', { name: 'MCP tools', exact: true }).click()
    await mobile.getByText('get_rangka_capabilities', { exact: true }).waitFor()
    await mobile.getByRole('button', { name: 'HTML color mode', exact: true }).click()
    await mobile.getByText(/HTML rangka follow the viewer/).waitFor()
    await mobile.getByRole('button', { name: 'HTML diagrams & charts', exact: true }).click()
    await mobile.getByText(/Add a/).filter({ hasText: /\.mermaid/ }).waitFor()
    const layout = await mobile.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth])
    assert.ok(layout[1] <= layout[0], 'expanded references fit on mobile')
    await mobile.screenshot({ path: '/tmp/serangkai-agent-reference-mobile.png' })
  } finally { await context.close() }
})

test('rangka history pages and actions work on a narrow screen', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 720 } })
  const mobile = await context.newPage()
  try {
    await mobile.goto(`${base}/auth/login`)
    await mobile.getByLabel('Username').fill(adminUsername)
    await mobile.getByLabel('Password').fill(adminPassword)
    await mobile.waitForFunction(hydrated)
    await mobile.getByRole('button', { name: 'Log in' }).click()
    await mobile.waitForURL(/\/(?:workspace)?$/)
    const id = await mobile.evaluate(async () => {
      const headers = { 'content-type': 'application/json' }
      const created = await fetch('/api/rangka', { method: 'POST', headers, body: JSON.stringify({ title: 'Long history on mobile', type: 'markdown', content: '# Version 1' }) })
      const id = (await created.json()).rangka.id
      for (let i = 2; i <= 10; i++) {
        const response = await fetch(`/api/rangka/${id}`, { method: 'PUT', headers, body: JSON.stringify({ content: `# Version ${i}`, baseVersion: i - 1 }) })
        if (!response.ok) throw new Error(`Failed to create version ${i}`)
      }
      return id
    })
    await mobile.goto(`${base}/rangka/${id}`)
    await mobile.getByRole('region', { name: 'Rangka content' }).waitFor()
    await mobile.screenshot({ path: '/tmp/serangkai-reader-mobile.png' })
    await mobile.getByRole('button', { name: 'History', exact: true }).click()
    await mobile.getByText('10 versions', { exact: true }).waitFor()
    assert.equal(await mobile.getByText('Page 1 of 2').isVisible(), true)
    const sizes = await mobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
    assert.ok(sizes.content <= sizes.viewport, `rangka page overflows: ${JSON.stringify(sizes)}`)
    await mobile.getByRole('navigation', { name: 'History pages' }).getByRole('button', { name: 'Next' }).click()
    await mobile.getByText('Page 2 of 2').waitFor()
    await mobile.getByRole('button', { name: 'View' }).last().click()
    const preview = mobile.getByRole('dialog', { name: 'Version 1' })
    await preview.waitFor()
    assert.match(await preview.innerText(), /# Version 1/)
    await mobile.keyboard.press('Escape')
    await preview.waitFor({ state: 'hidden' })
    await mobile.getByRole('dialog', { name: 'Version history', exact: true }).getByRole('button', { name: 'Close', exact: true }).click()
    await mobile.getByRole('dialog', { name: 'Version history', exact: true }).waitFor({ state: 'hidden' })
    await mobile.getByRole('button', { name: 'Edit', exact: true }).click()
    await mobile.getByRole('textbox', { name: 'Content' }).fill('# Version 11')
    await mobile.getByRole('button', { name: 'Save version' }).click()
    await mobile.getByText('Saved version 11').waitFor()
    await mobile.getByRole('button', { name: 'History', exact: true }).click()
    await mobile.getByText('11 versions', { exact: true }).waitFor()
    await mobile.keyboard.press('Escape')
    await mobile.getByRole('button', { name: 'Rangka actions' }).click()
    await mobile.getByRole('button', { name: 'Duplicate', exact: true }).waitFor()
  } finally { await context.close() }
})

test('Markdown code blocks have space after headings and before following text', async () => {
  const context = await browser.newContext()
  const reader = await context.newPage()
  try {
    await reader.goto(`${base}/auth/login`)
    await reader.getByLabel('Username').fill(adminUsername)
    await reader.getByLabel('Password').fill(adminPassword)
    await reader.waitForFunction(hydrated)
    await reader.getByRole('button', { name: 'Log in' }).click()
    await reader.waitForURL(/\/(?:workspace)?$/)
    const id = await reader.evaluate(async () => {
      const result = await fetch('/api/rangka', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Code spacing', type: 'markdown', content: '## Data Model\n\n```typescript\nconst value = 1\n```\n\nFollowing paragraph.' }) })
      return (await result.json()).rangka.id
    })
    await reader.goto(`${base}/rangka/${id}`)
    const heading = reader.getByRole('heading', { name: 'Data Model' })
    const block = reader.locator('.markdown-code-block')
    const paragraph = reader.getByText('Following paragraph.')
    await block.waitFor()
    const positions = await Promise.all([heading.boundingBox(), block.boundingBox(), paragraph.boundingBox()])
    assert.ok(positions.every(Boolean))
    assert.ok(positions[1].y - (positions[0].y + positions[0].height) >= 12, 'code block should have a visible gap after the heading')
    assert.ok(positions[2].y - (positions[1].y + positions[1].height) >= 12, 'following paragraph should have a visible gap after the code block')
    await block.getByRole('button', { name: 'Copy code' }).waitFor()
  } finally { await context.close() }
})
