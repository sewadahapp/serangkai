import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('CI workflow runs build, deployment invariants, provider contracts, and integration coverage', async () => {
  const workflow = await readFile(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8')
  for (const required of [
    'actions/checkout@v4',
    'actions/setup-node@v4',
    'npm ci --legacy-peer-deps',
    'npm run build:node',
    'npm run test:deployment-config',
    'npm run test:deployment-files',
    'npm run test:release-readiness',
    'npm run test:database',
    'npm run test:storage',
    'npm run test:r2',
    'tests/mcp-protocol.test.mjs',
    'tests/tokens-api.test.mjs',
    'tests/browser-workspace.test.mjs',
  ]) assert.match(workflow, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})
