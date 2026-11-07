import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { test, before, after } from 'node:test'
import { chromium } from 'playwright-core'

const port = 3720 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, browser, page

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-browser-test-'))
  child = spawn('node', ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
  page = await browser.newPage()
})

after(async () => { await browser?.close(); child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('human browser workflow registers and creates an artifact', async () => {
  await page.goto(`${base}/`)
  await assert.doesNotReject(() => page.getByText('Serangkai').first().waitFor())
  // The landing page's own snippets are highlighted, not only artifact Markdown.
  await assert.doesNotReject(() => page.locator('.serangkai-shiki span[style*="--shiki-light"]').first().waitFor())
  await page.getByRole('link', { name: 'Register' }).click()
  await page.getByLabel('Email').fill(`browser-${randomBytes(3).toString('hex')}@example.com`)
  await page.getByLabel('Password').fill('correct horse battery')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await page.waitForURL('**/workspace')
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Workspace' }).waitFor())
  await page.getByRole('button', { name: 'New folder' }).click()
  await page.getByLabel('Folder name').fill('Projects')
  await page.getByRole('button', { name: 'Create folder' }).click()
  await assert.doesNotReject(() => page.getByRole('button', { name: /Projects/ }).waitFor())
  await page.getByRole('button', { name: /Projects/ }).click()
  await page.getByRole('button', { name: 'New artifact' }).first().click()
  await page.getByLabel('Title').first().fill('Browser-created artifact')
  await page.locator('textarea').fill('# Browser flow')
  await page.getByRole('button', { name: 'Create artifact' }).click()
  await assert.doesNotReject(() => page.getByText('Browser-created artifact').waitFor())
  await assert.doesNotReject(() => page.getByText(/· Projects/).waitFor())
  await page.getByLabel('Rename').fill('Programs')
  await page.getByRole('button', { name: 'Rename' }).click()
  await assert.doesNotReject(() => page.getByRole('button', { name: /Programs/ }).waitFor())
  await assert.doesNotReject(() => page.getByText(/· Programs/).waitFor())
  await page.getByRole('button', { name: 'All artifacts' }).click()
  await page.getByRole('button', { name: 'New folder' }).click()
  await page.getByLabel('Folder name').fill('Archive')
  await page.getByRole('button', { name: 'Create folder' }).click()
  await assert.doesNotReject(() => page.getByRole('button', { name: /Archive/ }).waitFor())
  await page.getByRole('button', { name: /Programs/ }).click()
  await page.getByRole('combobox', { name: 'Move under' }).click()
  await page.getByRole('option', { name: 'Archive' }).click()
  await page.getByRole('button', { name: 'Move' }).click()
  await assert.doesNotReject(() => page.getByText('Folder moved.').waitFor())
  await assert.doesNotReject(() => page.getByText(/· Programs/).waitFor())
  await page.getByPlaceholder('Search artifacts and folders…').fill('Browser')
  await assert.doesNotReject(() => page.getByText(/In Programs and its subfolders/).waitFor())
  await page.getByPlaceholder('Search artifacts and folders…').fill('')
  await page.getByRole('link', { name: /Browser-created artifact/ }).click()
  await page.waitForURL('**/artifacts/**')
  await page.getByRole('combobox', { name: 'Visibility' }).click()
  await page.getByRole('option', { name: /Unlisted/ }).click()
  await page.getByRole('button', { name: 'Save visibility' }).click()
  const shareLink = page.getByRole('textbox', { name: 'Share link', exact: true })
  await assert.doesNotReject(() => shareLink.waitFor())
  assert.match(await shareLink.inputValue(), /\/share\/[^?]+\?k=[a-f0-9]{64}$/)
  assert.equal((await fetch(await shareLink.inputValue())).status, 200)

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  await page.getByRole('button', { name: 'Copy share link' }).click()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await shareLink.inputValue())

  await page.getByRole('button', { name: 'Edit' }).click()
  await page.locator('textarea').fill('# Browser flow revised')
  await page.getByRole('button', { name: 'Save version' }).click()
  await assert.doesNotReject(() => page.getByText('Saved version 2').waitFor())
  await page.getByRole('button', { name: 'View' }).last().click()
  await assert.doesNotReject(() => page.getByText('# Browser flow', { exact: true }).first().waitFor())
  await page.getByRole('button', { name: 'Restore' }).last().click()
  await assert.doesNotReject(() => page.getByText('Restored version 1 as version 3.').waitFor())
  await assert.doesNotReject(() => page.getByText('v3', { exact: true }).first().waitFor())

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.waitForURL('**/settings')
  await page.getByLabel('Name').fill('Browser token')
  await page.getByRole('button', { name: 'Create token' }).click()
  const tokenField = page.getByLabel('New API token')
  await assert.doesNotReject(() => tokenField.waitFor())
  assert.match(await tokenField.inputValue(), /^[A-Za-z0-9_-]{32}$/)
  await assert.doesNotReject(() => page.getByText('Browser token').first().waitFor())

  await page.getByRole('link', { name: 'Agents' }).first().click()
  await page.waitForURL('**/agent')
  await assert.doesNotReject(() => page.getByRole('textbox', { name: 'MCP endpoint', exact: true }).waitFor())
  assert.match(await page.getByRole('textbox', { name: 'MCP endpoint', exact: true }).inputValue(), /\/api\/mcp$/)
  assert.match(await page.getByRole('textbox', { name: 'REST endpoint', exact: true }).inputValue(), /\/api\/artifacts$/)
  await assert.doesNotReject(() => page.getByText('list_folders').first().waitFor())
  await assert.doesNotReject(() => page.getByText(/Bearer YOUR_TOKEN/).waitFor())

  await page.getByRole('link', { name: 'Overview' }).first().click()
  await page.waitForURL('**/dashboard')
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Overview' }).waitFor())
  await assert.doesNotReject(() => page.getByText('Recent activity').waitFor())
  await assert.doesNotReject(() => page.getByText('Browser-created artifact').first().waitFor())

  await page.getByRole('link', { name: 'Workspace', exact: true }).first().click()
  await page.waitForURL('**/workspace')
  await page.getByRole('link', { name: /Browser-created artifact/ }).click()
  await page.waitForURL('**/artifacts/**')
  await assert.doesNotReject(() => page.getByRole('link', { name: /Download/ }).waitFor())
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete artifact' }).click()
  await page.waitForURL('**/workspace')
  await assert.doesNotReject(() => page.getByText('No artifacts yet').waitFor())

  await page.getByRole('button', { name: 'Upload' }).click()
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
  await page.locator('input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: pixel })
  await page.getByRole('button', { name: 'Upload artifact' }).click()
  await assert.doesNotReject(() => page.getByText('pixel').first().waitFor())
  await page.getByRole('link', { name: /pixel/ }).first().click()
  await page.waitForURL('**/artifacts/**')
  const image = page.getByRole('img', { name: 'pixel' })
  await assert.doesNotReject(() => image.waitFor())
  assert.equal(await image.evaluate(element => element.complete && element.naturalWidth), 1)

  await page.getByRole('button', { name: 'Duplicate' }).click()
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'pixel (copy)' }).waitFor())
})

test('Markdown renders Mermaid diagrams and JSON charts', async () => {
  await page.goto(`${base}/workspace`)
  const artifactId = await page.evaluate(async () => {
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
      '{"type":"bar","title":"Routes","data":[{"label":"auth","value":4},{"label":"artifacts","value":13}]}',
      '```',
    ].join('\n')
    const res = await fetch('/api/artifacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Render check', type: 'markdown', content }),
    })
    return (await res.json()).artifact.id
  })

  await page.goto(`${base}/artifacts/${artifactId}`)
  await assert.doesNotReject(() => page.locator('.serangkai-mermaid svg').first().waitFor())
  await assert.doesNotReject(() => page.locator('.ts-chart-host svg').first().waitFor())
  assert.equal(await page.locator('.serangkai-mermaid svg').count(), 1)
  assert.equal(await page.locator('.ts-chart-host svg').count(), 1)
  assert.equal(await page.locator('.serangkai-chart pre').count(), 0)

  // Headings get ids for deep links...
  const headingId = await page.locator('h2', { hasText: 'Diagram' }).getAttribute('id')
  assert.equal(headingId, 'diagram')
  // ...but the in-app preview stays focused on the document itself.
  await assert.rejects(() => page.locator('section[aria-label="Contents"]').waitFor({ timeout: 500 }))
})

test('the share reader shows a table of contents', async () => {
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
    const created = await fetch('/api/artifacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Shared doc', type: 'markdown', content, visibility: 'unlisted' }),
    })
    const { artifact } = await created.json()
    const link = await fetch(`/api/artifacts/${artifact.id}/share`, { method: 'POST' })
    return (await link.json()).url
  })

  await page.goto(shareUrl)
  const tocLinks = page.locator('aside[aria-label="Table of contents"] a')
  await assert.doesNotReject(() => tocLinks.first().waitFor())
  assert.deepEqual(await tocLinks.allInnerTexts(), ['Diagram', 'Chart'])
  // The rail links to real headings, so SContentToc can track them.
  const href = await tocLinks.first().getAttribute('href')
  assert.equal(await page.locator(href).count(), 1)
})

test('JSON artifacts are syntax highlighted in the preview', async () => {
  const artifactId = await page.evaluate(async () => {
    const form = new FormData()
    form.append('file', new File(['{"brand":"Sewadah","concepts":[{"name":"Shared Space"}]}'], 'presentation-spec.json', { type: 'application/json' }), 'presentation-spec.json')
    form.append('title', 'presentation-spec')
    const res = await fetch('/api/artifacts/upload', { method: 'POST', body: form })
    return (await res.json()).artifact.id
  })

  await page.goto(`${base}/artifacts/${artifactId}`)
  await assert.doesNotReject(() => page.locator('.serangkai-shiki span[style*="--shiki-light"]').first().waitFor())
  assert.ok(await page.locator('.serangkai-shiki span[style*="--shiki-light"]').count() > 0)
  assert.match(await page.locator('.serangkai-prose, main').innerText(), /presentation-spec\.json/)
})

test('read-only values offer a working copy button', async () => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })

  await page.goto(`${base}/agent`)
  const mcpCopy = page.getByRole('button', { name: 'Copy MCP endpoint' })
  await assert.doesNotReject(() => mcpCopy.waitFor())
  await assert.doesNotReject(() => page.getByRole('button', { name: 'Copy REST endpoint' }).waitFor())
  await mcpCopy.click()
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /\/api\/mcp$/)
  // The control acknowledges the copy instead of staying silent.
  assert.equal(await page.getByRole('button', { name: 'Copied' }).count(), 1)
})

test('shared HTML artifacts open in the reader with the app chrome', async () => {
  const shareUrl = await page.evaluate(async () => {
    const html = '<!doctype html><html><head><title>Framed</title></head><body><h1>Frame content</h1></body></html>'
    const form = new FormData()
    form.append('file', new File([html], 'framed.html', { type: 'text/html' }), 'framed.html')
    form.append('title', 'framed')
    form.append('visibility', 'unlisted')
    const created = await fetch('/api/artifacts/upload', { method: 'POST', body: form })
    const { artifact } = await created.json()
    const share = await fetch(`/api/artifacts/${artifact.id}/share`, { method: 'POST' })
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
})
