import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('Cloudflare and Vercel deployment configuration declares supported Nitro presets', async () => {
  const nitro = await readFile(new URL('../nitro.config.ts', import.meta.url), 'utf8')
  const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.match(nitro, /cloudflare_module/)
  assert.match(nitro, /vercel/)
  assert.match(wrangler, /nodejs_compat/)
  assert.match(wrangler, /"binding": "ARTIFACTS"/)
  assert.equal(vercel.buildCommand, 'bun run build:vercel')
  assert.equal(vercel.installCommand, 'bun install --frozen-lockfile --ignore-scripts')
  assert.equal(vercel.functions['api/**/*.mjs'].runtime, 'nodejs24.x')
  assert.equal(pkg.packageManager, 'bun@1.4.0')
  assert.equal(pkg.scripts['build:cloudflare'], 'bun run build:runtime && NITRO_PRESET=cloudflare_module bun --bun run nuxt build')
})
