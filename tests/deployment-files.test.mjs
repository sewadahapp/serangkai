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
