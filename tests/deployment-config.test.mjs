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
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  // No R2 binding: this path must not provision or require R2 activation.
  assert.equal(config.r2_buckets, undefined)
  // D1 is still the database, and the S3 driver is selected via plain vars.
  assert.equal(config.d1_databases[0].binding, 'DB')
  assert.equal(config.vars.STORAGE_DRIVER, 's3')
  assert.equal(config.assets.binding, 'ASSETS')
  assert.equal(config.main, './.output/server/index.mjs')
  assert.ok(config.compatibility_flags.includes('nodejs_compat'))
  // Account-specific ids and credentials stay out of the repository.
  assert.equal(config.d1_databases[0].database_id, undefined)
  for (const key of ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) assert.equal(config.vars[key], undefined)

  assert.match(pkg.scripts['deploy:b2'], /build:cloudflare/)
  assert.match(pkg.scripts['deploy:b2'], /wrangler deploy --config wrangler\.b2\.jsonc/)
})

test('the Turso path provisions R2 without D1 and keeps database credentials out of config', async () => {
  const config = await readJsonc('../wrangler.turso.jsonc')
  assert.equal(config.d1_databases, undefined)
  assert.equal(config.vars.DATABASE_DRIVER, 'turso')
  assert.equal(config.vars.STORAGE_DRIVER, 'r2-binding')
  assert.equal(config.r2_buckets[0].binding, 'RANGKA')
  assert.equal(config.r2_buckets[0].bucket_name, undefined)
  assert.equal(config.main, './.output/server/index.mjs')
  assert.equal(config.assets.binding, 'ASSETS')
  assert.ok(config.compatibility_flags.includes('nodejs_compat'))
  assert.equal(config.vars.TURSO_AUTH_TOKEN, undefined)
  assert.equal(config.vars.TURSO_DATABASE_URL, undefined)
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.scripts['deploy:turso'], 'bun run build:cloudflare && wrangler deploy --config wrangler.turso.jsonc')
})

test('Turso and B2 require neither a D1 nor an R2 binding', async () => {
  const config = await readJsonc('../wrangler.turso-b2.jsonc')
  assert.equal(config.d1_databases, undefined)
  assert.equal(config.r2_buckets, undefined)
  assert.equal(config.vars.DATABASE_DRIVER, 'turso')
  assert.equal(config.vars.STORAGE_DRIVER, 's3')
  assert.deepEqual(Object.keys(config.vars).sort(), ['DATABASE_DRIVER', 'NODE_ENV', 'STORAGE_DRIVER'])
  assert.equal(config.assets.binding, 'ASSETS')
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.scripts['deploy:turso-b2'], 'bun run build:cloudflare && wrangler deploy --config wrangler.turso-b2.jsonc')
})

const cloudflareChoices = [
  ['wrangler.jsonc', 'deploy'],
  ['wrangler.b2.jsonc', 'deploy:b2'],
  ['wrangler.turso.jsonc', 'deploy:turso'],
  ['wrangler.turso-b2.jsonc', 'deploy:turso-b2'],
]

test('the Cloudflare guide deploys a fork with one command per provider combination', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  const guide = await readFile(new URL('../docs/deploy-cloudflare.md', import.meta.url), 'utf8')
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  // The Deploy to Cloudflare button copies the repository instead of forking
  // it, so its copies never receive updates.
  for (const doc of [readme, guide]) assert.doesNotMatch(doc, /deploy\.workers\.cloudflare\.com/)
  assert.match(readme, /\]\(docs\/deploy-cloudflare\.md\)/)
  assert.match(guide, /Import a\s+repository/)
  assert.match(guide, /Sync\s+fork/)

  for (const [file, script] of cloudflareChoices) {
    const config = await readJsonc(`../${file}`)
    // Workers Builds deploys to the Worker named in the config; every choice
    // must match the project name the guide tells users to keep.
    assert.equal(config.name, 'serangkai', file)
    assert.match(pkg.scripts[script], /^bun run build:cloudflare && wrangler deploy/, script)
    assert.ok(guide.includes(`\`bun run ${script}\``), `guide must list bun run ${script}`)
  }
})

test('.dev.vars.example lists every secret a Cloudflare choice can need', async () => {
  const example = await readFile(new URL('../.dev.vars.example', import.meta.url), 'utf8')
  const guide = await readFile(new URL('../docs/deploy-cloudflare.md', import.meta.url), 'utf8')
  const required = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(match => match[1]).sort()
  assert.deepEqual(required, ['ADMIN_PASSWORD', 'ADMIN_USERNAME', 'JWT_SECRET', 'NUXT_APP_SECRET', 'SHARE_SECRET'])
  for (const key of ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
    assert.match(example, new RegExp(`^# ${key}=`, 'm'), `${key} must be listed as optional`)
  }
  for (const key of [...required, 'TURSO_DATABASE_URL', 'S3_SECRET_ACCESS_KEY']) assert.ok(guide.includes(`\`${key}\``), `guide must name ${key}`)
})
