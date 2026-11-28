import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test } from 'node:test'
import { adminEnv, adminUsername, adminPassword, login } from './helpers/auth.mjs'
import { startLibsqlMock } from './helpers/libsql-mock.mjs'

for (const runtime of ['bun', 'node']) {
  test(`${runtime} serves Turso-backed rangka and preserves auth, versions and files across restart`, async t => {
    const mock = startLibsqlMock()
    const dataDir = await mkdtemp(join(tmpdir(), 'serangkai-turso-'))
    const port = 42000 + Math.floor(Math.random() * 10000)
    const base = `http://127.0.0.1:${port}`
    const env = {
      ...process.env, ...adminEnv(), NODE_ENV: 'production',
      PORT: String(port), HOST: '127.0.0.1',
      JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'),
      DATABASE_DRIVER: 'turso', TURSO_DATABASE_URL: mock.url, TURSO_AUTH_TOKEN: mock.token,
      DATABASE_PATH: join(dataDir, 'unused', 'serangkai.db'),
      STORAGE_DRIVER: 'local', STORAGE_PATH: join(dataDir, 'files'),
    }
    let child, output = ''
    async function stop() {
      if (!child || child.exitCode !== null || child.signalCode !== null) return
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      await exited
    }
    t.after(async () => { await stop(); await mock.close(); await rm(dataDir, { recursive: true, force: true }) })
    async function start() {
      output = ''
      child = spawn(runtime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env, stdio: ['ignore', 'pipe', 'pipe'] })
      child.stdout.on('data', data => { output += data })
      child.stderr.on('data', data => { output += data })
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null) break
        try { if ((await fetch(`${base}/api/health`)).ok) return } catch {}
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error(`Server did not start: ${output}`)
    }
    await start()
    mock.failNext()
    const unavailable = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: adminUsername, password: adminPassword }),
    })
    assert.equal(unavailable.status, 500, 'initialization errors must surface without local fallback')
    const [{ cookie }] = await Promise.all([login(base), login(base)])
    const headers = { cookie, 'content-type': 'application/json' }
    const response = await fetch(`${base}/api/rangka`, {
      method: 'POST', headers, body: JSON.stringify({ title: 'Turso runtime', type: 'markdown', content: '# Remote metadata' }),
    })
    assert.equal(response.status, 200, await response.clone().text())
    const { rangka } = await response.json()
    assert.equal((await fetch(`${base}/api/rangka/${rangka.id}`)).status, 401)
    const update = await fetch(`${base}/api/rangka/${rangka.id}`, {
      method: 'PUT', headers, body: JSON.stringify({ baseVersion: 1, content: '# Updated remote rangka' }),
    })
    assert.equal(update.status, 200)
    // Rangka data goes through the guarded single-statement upsert on libSQL too.
    const board = (await (await fetch(`${base}/api/rangka`, { method: 'POST', headers, body: JSON.stringify({ title: 'Turso board', type: 'html', content: '<!doctype html><html><head></head><body>board</body></html>' }) })).json()).rangka
    const dataPath = `${base}/api/rangka/${board.id}/data/cards/c1`
    assert.equal((await fetch(dataPath, { method: 'PUT', headers, body: JSON.stringify({ data: { title: 'Remote card' } }) })).status, 200)
    assert.equal((await fetch(dataPath, { method: 'PATCH', headers, body: JSON.stringify({ data: { column: 'done' } }) })).status, 200)
    assert.deepEqual((await fetch(`${dataPath}?optional=1`, { headers }).then(r => r.json())).document.data, { title: 'Remote card', column: 'done' })
    const minted = await fetch(`${base}/api/tokens`, {
      method: 'POST', headers, body: JSON.stringify({ name: 'Turso read', scopes: ['read'] }),
    })
    assert.equal(minted.status, 200)
    const { token } = await minted.json()
    const bearer = { authorization: `Bearer ${token}` }
    assert.equal((await fetch(`${base}/api/rangka`, { method: 'POST', headers: { ...bearer, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Denied', type: 'markdown', content: 'denied' }) })).status, 403)
    await stop()
    await start()
    const loaded = await fetch(`${base}/api/rangka/${rangka.id}`, { headers: bearer })
    assert.equal(loaded.status, 200, await loaded.clone().text())
    assert.match((await loaded.json()).content, /Updated remote rangka/)
    assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions`, { headers: { cookie } })).status, 200, 'browser session survives restart')
    assert.equal((await fetch(dataPath, { headers: bearer }).then(r => r.json())).document.data.column, 'done', 'data survives restart')
    assert.equal(mock.sqlite.query('SELECT COUNT(*) AS n FROM rangka_data').get().n, 1)
    assert.equal(mock.sqlite.query('SELECT COUNT(*) AS n FROM users').get().n, 1)
    assert.ok(mock.sqlite.query('SELECT COUNT(*) AS n FROM rangka_versions').get().n >= 1)
    assert.equal(existsSync(env.DATABASE_PATH), false, 'remote selection must never create a local database')
  })
}
