import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

/**
 * Release readiness: the README is the only place left that states what is and
 * is not verified, so this guards those claims directly. The per-provider
 * documents it used to check were removed when the repo was prepared to go
 * public; deployment-file invariants live in deployment-files.test.mjs.
 */
test('the README describes only locally exercised deployment paths', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')

  // Docker persistence is exercised locally; hosted platforms are not claimed.
  assert.match(readme, /Docker persistence is checked locally with Podman/)

  // That must never be upgraded into a supported platform contract, and no
  // workflow here deploys on its own.
  assert.match(readme, /no platform is a supported contract/)
  assert.match(readme, /nothing\s+in this repository deploys\s+anywhere on its own/i)
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

test('the README documents how images are actually published', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')

  // The release workflow exists and is manual.
  const workflow = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
  assert.match(workflow, /workflow_dispatch:/)

  // The README must explain that images come from a manual release, and must
  // not imply that pushing to master publishes one.
  assert.match(readme, /Images are published by the \*\*Release\*\* workflow/)
  assert.match(readme, /Actions → Release → Run workflow/)
  assert.match(readme, /docker compose up --build/)

  // The one step CI cannot do for the operator.
  assert.match(readme, /Change visibility/)
})

test('the README keeps credentials environment-provided', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')

  assert.match(readme, /ADMIN_USERNAME/)
  assert.match(readme, /SHARE_SECRET/)
  // A placeholder is fine; a real-looking committed secret is not.
  assert.match(readme, /choose-a-strong-password/)
  assert.doesNotMatch(readme, /ADMIN_PASSWORD=['"][^'"]*[A-Za-z0-9]{12,}['"]/)
})

test('the declared license exists as a file', async () => {
  // "MIT" in a README is a statement of intent, not a grant of rights. A public
  // repository needs the actual text, and package.json must agree with it.
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.license, 'MIT')

  const license = await readFile(new URL('../LICENSE', import.meta.url), 'utf8')
  assert.match(license, /^MIT License/)
  assert.match(license, /Copyright \(c\) \d{4} Sewadah/)
  assert.match(license, /WITHOUT WARRANTY OF ANY KIND/)

  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  assert.match(readme, /\[LICENSE\]\(LICENSE\)/)
})
