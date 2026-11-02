import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { test, before, after } from 'node:test'

const port = 4020 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child
let stderr = ''

before(async () => {
  child = spawn('npx', ['wrangler', 'dev', '.output/server/index.mjs', '--assets', '.output/public', '--local', '--port', String(port), '--show-interactive-dev-session=false'], { cwd: process.cwd(), env: { ...process.env, JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex') }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stderr.on('data', chunk => { stderr += chunk.toString() })
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return } catch {} await new Promise(resolve => setTimeout(resolve, 200)) }
  throw new Error(`Wrangler local Worker did not start\n${stderr}`)
})

after(async () => { child?.kill('SIGTERM'); await rm('.wrangler', { recursive: true, force: true }) })

test('Cloudflare local D1 runtime supports registration, artifact creation, and listing', async () => {
  const email = `d1-${randomBytes(3).toString('hex')}@example.com`
  const registered = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct horse battery' }) })
  assert.equal(registered.status, 200, await registered.text())
  const cookie = registered.headers.get('set-cookie')
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'D1 runtime artifact', type: 'markdown', content: '# D1' }) })
  assert.equal(created.status, 200, await created.text())
  const listed = await fetch(`${base}/api/artifacts`, { headers: { cookie } })
  assert.equal(listed.status, 200)
  assert.equal((await listed.json()).artifacts[0].title, 'D1 runtime artifact')
})
