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
  assert.match(wrangler, /"binding": "RANGKA"/)
  assert.equal(vercel.buildCommand, 'bun run build:vercel')
  assert.equal(vercel.installCommand, 'bun install --frozen-lockfile --ignore-scripts')
  assert.equal(vercel.functions['api/**/*.mjs'].runtime, 'nodejs24.x')
  assert.equal(pkg.packageManager, 'bun@1.4.0')
  assert.equal(pkg.scripts['build:cloudflare'], 'bun run build:runtime && NITRO_PRESET=cloudflare_module bun --bun run nuxt build')
})

const readJsonc = async path => JSON.parse((await readFile(new URL(path, import.meta.url), 'utf8'))
  // The checked-in configs use line comments only; strip them for parsing.
  .replace(/\s+\/\/.*$/gm, ''))

test('the Backblaze B2 path uses D1 without R2 and never commits credentials', async () => {
  const config = await readJsonc('../wrangler.b2.jsonc')
  const templateConfig = await readJsonc('../deploy/cloudflare-b2/wrangler.jsonc')
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  for (const candidate of [config, templateConfig]) {
    // No R2 binding: this path must not provision or require R2 activation.
    assert.equal(candidate.r2_buckets, undefined)
    // D1 is still the database, and the S3 driver is selected via plain vars.
    assert.equal(candidate.d1_databases[0].binding, 'DB')
    assert.equal(candidate.vars.STORAGE_DRIVER, 's3')
    assert.equal(candidate.assets.binding, 'ASSETS')
    assert.equal(candidate.main, './.output/server/index.mjs')
    assert.ok(candidate.compatibility_flags.includes('nodejs_compat'))
    // Account-specific ids stay out of the repository.
    assert.equal(candidate.d1_databases[0].database_id, undefined)
  }

  // Manual deployments build the Cloudflare preset with the B2 config.
  assert.match(pkg.scripts['deploy:b2'], /build:cloudflare/)
  assert.match(pkg.scripts['deploy:b2'], /wrangler deploy --config wrangler\.b2\.jsonc/)

  // The B2 template is a standalone button target: it builds the application
  // source itself (the platform copies only the subdirectory) and prompts for
  // the S3 credentials without committing them.
  const templatePkg = JSON.parse(await readFile(new URL('../deploy/cloudflare-b2/package.json', import.meta.url), 'utf8'))
  const devVars = await readFile(new URL('../deploy/cloudflare-b2/.dev.vars.example', import.meta.url), 'utf8')
  const build = await readFile(new URL('../deploy/cloudflare-b2/build.mjs', import.meta.url), 'utf8')
  for (const key of ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
    'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'JWT_SECRET', 'SHARE_SECRET', 'NUXT_APP_SECRET']) {
    assert.match(devVars, new RegExp(`^${key}=`, 'm'), `${key} must be prompted in the B2 template`)
    assert.ok(templatePkg.cloudflare?.bindings?.[key], `${key} must have a binding description`)
  }
  assert.match(templatePkg.scripts.build, /node build\.mjs/)
  assert.match(build, /codeload\.github\.com|tar\.gz/)
  assert.match(build, /build:cloudflare/)
  assert.doesNotMatch(devVars, /AKIA|BEGIN [A-Z ]*PRIVATE KEY/)

  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  assert.match(readme, /deploy\.workers\.cloudflare\.com\/\?url=https:\/\/github\.com\/sewadahapp\/serangkai\/tree\/master\/deploy\/cloudflare-b2/)
})
