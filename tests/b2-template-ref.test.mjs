import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, after } from 'node:test'
import { resolveRef, DEFAULT_BRANCH } from '../deploy/cloudflare-b2/ref.mjs'

const dir = mkdtempSync(join(tmpdir(), 'serangkai-ref-'))
const pinFile = join(dir, 'serangkai.ref')
after(() => rmSync(dir, { recursive: true, force: true }))

test('explicit SERANGKAI_REF override always wins', () => {
  writeFileSync(pinFile, 'pinned-commit\n')
  const result = resolveRef({ env: { SERANGKAI_REF: 'my-branch' }, pinFile })
  assert.deepEqual(result, { ref: 'my-branch', source: 'env' })
})

test('committed pin is used when there is no override (reproducible default)', () => {
  writeFileSync(pinFile, 'abc123def\n')
  const result = resolveRef({ env: {}, pinFile })
  assert.deepEqual(result, { ref: 'abc123def', source: 'pin' })
})

test('falls back to the development branch only when no pin exists', () => {
  rmSync(pinFile, { force: true })
  const result = resolveRef({ env: {}, pinFile })
  assert.deepEqual(result, { ref: DEFAULT_BRANCH, source: 'default' })
})

test('blank override and blank pin do not count as pins', () => {
  writeFileSync(pinFile, '   \n')
  assert.equal(resolveRef({ env: { SERANGKAI_REF: '  ' }, pinFile }).source, 'default')
})

test('the shipped template pin is an immutable commit, not a moving branch', async () => {
  const { readFileSync } = await import('node:fs')
  const pin = readFileSync(new URL('../deploy/cloudflare-b2/serangkai.ref', import.meta.url), 'utf8').trim()
  assert.match(pin, /^[0-9a-f]{40}$/, 'default B2 builds must pin a full commit SHA (or a release tag), not master')
})
