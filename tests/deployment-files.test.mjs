import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('deployment files require stable secrets and persistent storage', async () => {
  const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8')
  const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8')
  assert.match(compose, /JWT_SECRET:\s*\$\{JWT_SECRET:\?/) 
  assert.match(compose, /SHARE_SECRET:\s*\$\{SHARE_SECRET:\?/) 
  assert.match(compose, /serangkai-data:\/app\/data/)
  assert.match(dockerfile, /HEALTHCHECK/)
  assert.match(dockerfile, /docker-entrypoint\.sh/)
})

test('published-image compose file keeps secrets, volume, and health checks', async () => {
  const compose = await readFile(new URL('../docker-compose.image.yml', import.meta.url), 'utf8')
  assert.match(compose, /image:\s*\$\{SERANGKAI_IMAGE:\?/)
  assert.match(compose, /JWT_SECRET:\s*\$\{JWT_SECRET:\?/)
  assert.match(compose, /SHARE_SECRET:\s*\$\{SHARE_SECRET:\?/)
  assert.match(compose, /serangkai-data:\/app\/data/)
  assert.match(compose, /\/api\/health/)
  assert.doesNotMatch(compose, /build:/)
})

test('Docker image workflow publishes multi-arch images without deploying', async () => {
  const workflow = await readFile(new URL('../.github/workflows/docker.yml', import.meta.url), 'utf8')
  assert.match(workflow, /docker\/build-push-action@v6/)
  assert.match(workflow, /ghcr\.io\/\$\{\{ github\.repository \}\}/)
  assert.match(workflow, /linux\/amd64,linux\/arm64/)
  assert.match(workflow, /pull_request/)
  assert.match(workflow, /push:\s*\$\{\{ github\.event_name != 'pull_request' \}\}/)
  assert.doesNotMatch(workflow, /wrangler deploy|vercel deploy/)
})
