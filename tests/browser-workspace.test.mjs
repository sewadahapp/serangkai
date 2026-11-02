import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
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
  await page.getByRole('link', { name: 'Register' }).click()
  await page.locator('input[type="email"]').fill(`browser-${randomBytes(3).toString('hex')}@example.com`)
  await page.locator('input[type="password"]').fill('correct horse battery')
  await page.getByRole('button', { name: 'Register' }).click()
  await page.waitForURL('**/workspace')
  await assert.doesNotReject(() => page.getByRole('heading', { name: 'Workspace' }).waitFor())
  await page.getByRole('button', { name: 'New Artifact' }).click()
  await page.getByPlaceholder('Artifact title').fill('Browser-created artifact')
  await page.locator('textarea').fill('# Browser flow')
  await page.getByRole('button', { name: 'Create artifact' }).click()
  await assert.doesNotReject(() => page.getByText('Browser-created artifact').waitFor())
  await page.getByRole('link', { name: /Browser-created artifact/ }).click()
  await page.waitForURL('**/artifacts/**')
  await page.selectOption('select[aria-label="Artifact visibility"]', 'unlisted')
  await page.getByRole('button', { name: 'Save visibility' }).click()
  const shareLink = page.getByLabel('Share link')
  await assert.doesNotReject(() => shareLink.waitFor())
  assert.match(await shareLink.inputValue(), /\/api\/share\/[^?]+\?k=[a-f0-9]{64}$/)
  assert.equal((await fetch(await shareLink.inputValue())).status, 200)
})
