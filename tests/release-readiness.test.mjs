import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('release readiness keeps provider claims and credentials boundaries explicit', async () => {
  const matrix = await readFile(new URL('../docs/deployment/verification-matrix.md', import.meta.url), 'utf8')
  const index = await readFile(new URL('../docs/deployment/README.md', import.meta.url), 'utf8')
  const insta = await readFile(new URL('../docs/deployment/instacloud.md', import.meta.url), 'utf8')
  const cloudflare = await readFile(new URL('../docs/deployment/cloudflare.md', import.meta.url), 'utf8')
  const vercel = await readFile(new URL('../docs/deployment/vercel.md', import.meta.url), 'utf8')
  const runbook = await readFile(new URL('../docs/deployment/remote-verification-runbook.md', import.meta.url), 'utf8')
  assert.match(matrix, /InstaCloud \| Generic Docker checklist and image run path only \| Not verified/)
  assert.match(matrix, /Cloudflare R2 \| Local Wrangler R2 binding/)
  assert.match(matrix, /Vercel \| Nitro Build Output and local Node runtime/)
  assert.match(insta, /Verification status: not verified/)
  assert.match(insta, /Docker image path/)
  assert.match(insta, /docker-compose\.image\.yml/)
  assert.match(cloudflare, /real Cloudflare deployment still\s+requires/)
  assert.match(vercel, /not production-ready for durable data/)
  assert.match(index, /InstaCloud \| Generic container checklist \| \*\*Not verified\*\*/)
  assert.match(index, /Not deployed remotely/)
  assert.match(runbook, /The InstaCloud deployment contract is not verified/)
  assert.match(runbook, /common acceptance checks/)
  assert.match(runbook, /bun run test:provider-local/)
  assert.match(index, /bun run test:provider-local/)
})
