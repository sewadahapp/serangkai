import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { adminEnv, login } from './helpers/auth.mjs'
import { startLibsqlMock } from './helpers/libsql-mock.mjs'

test('Cloudflare Worker uses Turso over HTTP even when a D1 binding exists', async t => {
  const mock = startLibsqlMock()
  const stateDir = await mkdtemp(join(tmpdir(), 'serangkai-turso-worker-'))
  const port = 42000 + Math.floor(Math.random() * 10000)
  const base = `http://127.0.0.1:${port}`
  const vars = {
    ...adminEnv(), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'),
    NUXT_APP_SECRET: process.env.NUXT_APP_SECRET, NUXT_SESSION_COOKIE_SECURE: 'false',
    DATABASE_DRIVER: 'turso', TURSO_DATABASE_URL: mock.url, TURSO_AUTH_TOKEN: mock.token,
  }
  const args = ['wrangler', 'dev', '.output/server/index.mjs', '--assets', '.output/public', '--local', '--port', String(port), '--persist-to', stateDir, '--show-interactive-dev-session=false']
  for (const [name, value] of Object.entries(vars)) args.push('--var', `${name}:${value}`)
  const child = spawn('bunx', args, { cwd: process.cwd(), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  let output = ''
  child.stdout.on('data', data => { output += data })
  child.stderr.on('data', data => { output += data })
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit')
      const signal = value => { try { process.kill(-child.pid, value) } catch {} }
      signal('SIGTERM')
      const timer = setTimeout(() => signal('SIGKILL'), 5000)
      await exited
      clearTimeout(timer)
    }
    await mock.close()
    await rm(stateDir, { recursive: true, force: true })
  })
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) break
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.ok(ready, `Worker did not start: ${output}`)
  const { cookie } = await login(base)
  const response = await fetch(`${base}/api/rangka`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Turso Worker', type: 'markdown', content: '# Turso on Workers' }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  const { rangka } = await response.json()
  assert.equal(mock.sqlite.query('SELECT title FROM rangka WHERE id = ?').get(rangka.id).title, 'Turso Worker')
  const loaded = await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie } })
  assert.equal(loaded.status, 200)
  assert.match((await loaded.json()).content, /Turso on Workers/)
})
