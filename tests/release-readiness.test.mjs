import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

/**
 * Release readiness: the README is the only place left that states what is and
 * is not verified, so this guards those claims directly. The per-provider
 * documents it used to check were removed when the repo was prepared to go
 * public; deployment-file invariants live in deployment-files.test.mjs.
 */
test('the README keeps provider claims and credential boundaries explicit', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')

  // It must not imply a remote deployment happened.
  assert.match(readme, /None of these has been deployed to a remote provider/)
  assert.match(readme, /InstaCloud has no verified deployment contract/)

  // The evaluation commands it names must exist as scripts.
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  for (const script of ['test:provider-local', 'test:docker', 'build:cloudflare', 'build:vercel']) {
    assert.ok(pkg.scripts[script], `README names bun run ${script}, which must exist`)
  }

  // Credentials stay environment-provided. The Docker example may show a
  // placeholder, but never a real-looking committed secret.
  assert.match(readme, /ADMIN_USERNAME/)
  assert.match(readme, /SHARE_SECRET/)
  assert.match(readme, /choose-a-strong-password/)
})
