import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

/**
 * Release readiness: the README is the only place left that states what is and
 * is not verified, so this guards those claims directly. The per-provider
 * documents it used to check were removed when the repo was prepared to go
 * public; deployment-file invariants live in deployment-files.test.mjs.
 */
test('the README describes one smoke-tested instance without claiming support', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')

  // One deployment was exercised, and it is named as such.
  assert.match(readme, /deployed by hand and checked from the outside/)

  // But that must never be upgraded into a supported platform contract, and no
  // workflow here deploys on its own.
  assert.match(readme, /not a supported platform contract/)
  assert.match(readme, /nothing\s+in this repository deploys anywhere on its own/)

  // The live instance URL is deliberately not advertised in a public README.
  assert.doesNotMatch(readme, /instacloud-edge\.com/)
})

test('the README only names commands and images that actually resolve', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  for (const script of ['test:provider-local', 'test:docker', 'build:cloudflare', 'build:vercel']) {
    assert.ok(pkg.scripts[script], `README names bun run ${script}, which must exist`)
  }

  // The quick-start image must be the one CI publishes, not a placeholder.
  assert.match(readme, /ghcr\.io\/sewadahapp\/serangkai:latest/)
  assert.doesNotMatch(readme, /yourusername|OWNER\/REPO/)
})

test('the README keeps credentials environment-provided', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')

  assert.match(readme, /ADMIN_USERNAME/)
  assert.match(readme, /SHARE_SECRET/)
  // A placeholder is fine; a real-looking committed secret is not.
  assert.match(readme, /choose-a-strong-password/)
  assert.doesNotMatch(readme, /ADMIN_PASSWORD=['"][^'"]*[A-Za-z0-9]{12,}['"]/)
})
