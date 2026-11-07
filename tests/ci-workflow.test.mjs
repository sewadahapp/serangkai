import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('CI workflow uses Bun for install, build, and integration coverage', async () => {
  const workflow = await readFile(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8')
  for (const required of [
    'actions/checkout@v4',
    'oven-sh/setup-bun@v2',
    'bun-version: 1.4.0',
    'bun install --frozen-lockfile --ignore-scripts',
    'bun run build:node',
    'bun run test:deployment-config',
    'bun run test:deployment-files',
    'bun run test:release-readiness',
    'bun run test:database',
    'tests/mcp-protocol.test.mjs',
    'tests/tokens-api.test.mjs',
    'tests/folders-api.test.mjs',
    'tests/artifacts-lifecycle.test.mjs',
    'tests/browser-workspace.test.mjs',
  ]) assert.match(workflow, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(workflow, /npm (ci|run)/)
  assert.doesNotMatch(workflow, /package-lock\.json/)
})
