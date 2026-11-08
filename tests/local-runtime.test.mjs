import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 3920 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-local-runtime-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  throw new Error('server did not start')
})
after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('local runtime uses SQLite through the provider-aware route path', async () => {
  const { cookie } = await login(base)
  const artifact = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Provider runtime', type: 'markdown', content: '# SQLite route' }) })
  assert.equal(artifact.status, 200)
  const list = await fetch(`${base}/api/artifacts`, { headers: { cookie } })
  assert.equal((await list.json()).artifacts[0].title, 'Provider runtime')
})
