import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 4220 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-vercel-runtime-'))
  child = spawn('node', ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  throw new Error('Vercel Node function preview did not start')
})
after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('Vercel Node runtime path supports owner login and artifact listing', async () => {
  const { cookie } = await login(base)
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Vercel runtime', type: 'markdown', content: '# Vercel' }) })
  assert.equal(created.status, 200)
  const listed = await fetch(`${base}/api/artifacts`, { headers: { cookie } })
  assert.equal((await listed.json()).artifacts[0].title, 'Vercel runtime')
})
