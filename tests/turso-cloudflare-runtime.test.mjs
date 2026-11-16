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
import { startS3Mock } from './helpers/s3-mock.mjs'

for (const variant of [
  { label: 'Turso overrides an existing D1 binding', config: 'wrangler.jsonc', overrideDriver: true },
  { label: 'Turso template runs without a D1 binding', config: process.env.SERANGKAI_TEST_TURSO_CONFIG || 'wrangler.turso.jsonc', overrideDriver: false },
  { label: 'Turso and B2 run without D1 or R2 bindings', config: process.env.SERANGKAI_TEST_TURSO_B2_CONFIG || 'wrangler.turso-b2.jsonc', storage: 'b2' },
]) {
  test(`Cloudflare Worker: ${variant.label}`, async t => {
    const mock = startLibsqlMock()
    const s3 = variant.storage === 'b2' ? await startS3Mock() : null
    const stateDir = await mkdtemp(join(tmpdir(), 'serangkai-turso-worker-'))
    const port = 42000 + Math.floor(Math.random() * 10000)
    const base = `http://127.0.0.1:${port}`
    const vars = {
      ...adminEnv(), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'),
      NUXT_APP_SECRET: process.env.NUXT_APP_SECRET, NUXT_SESSION_COOKIE_SECURE: 'false',
      TURSO_DATABASE_URL: mock.url, TURSO_AUTH_TOKEN: mock.token,
    }
    if (variant.overrideDriver) vars.DATABASE_DRIVER = 'turso'
    if (s3) Object.assign(vars, {
      S3_ENDPOINT: s3.endpoint, S3_REGION: s3.region, S3_BUCKET: s3.bucket,
      S3_ACCESS_KEY_ID: s3.keyId, S3_SECRET_ACCESS_KEY: s3.secret,
    })
    const args = ['wrangler', 'dev', '--config', variant.config, '--local', '--port', String(port), '--persist-to', stateDir, '--show-interactive-dev-session=false']
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
      await s3?.close()
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

    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 255])
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: 'image/png' }), 'turso-upload.png')
    form.append('title', 'Turso R2 upload')
    const uploaded = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie }, body: form })
    assert.equal(uploaded.status, 200, await uploaded.clone().text())
    const file = (await uploaded.json()).rangka
    const downloaded = await fetch(`${base}/api/rangka/${file.id}/download`, { headers: { cookie } })
    assert.equal(downloaded.status, 200)
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), bytes)
    if (s3) {
      assert.ok(s3.requests.length > 0)
      assert.ok(s3.requests.every(request => request.signed), 'B2 requests must be signed')
    }
  })
}
