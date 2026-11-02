import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('Cloudflare and Vercel deployment configuration declares supported Nitro presets', async () => {
  const nitro = await readFile(new URL('../nitro.config.ts', import.meta.url), 'utf8')
  const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  const vercel = await readFile(new URL('../vercel.json', import.meta.url), 'utf8')
  assert.match(nitro, /cloudflare_module/)
  assert.match(nitro, /vercel/)
  assert.match(wrangler, /nodejs_compat/)
  assert.equal(JSON.parse(vercel).buildCommand, 'npm run build:vercel')
  assert.equal(JSON.parse(vercel).functions['api/**/*.mjs'].runtime, 'nodejs24.x')
})
