import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test } from 'node:test'
import bcrypt from 'bcryptjs'
import { serverRuntime } from './helpers/server.mjs'
import { adminPassword, adminUsername, login, seedUser } from './helpers/auth.mjs'

const root = join(import.meta.dirname, '..')
const basePort = 4600 + Math.floor(Math.random() * 200)

async function waitForHealth(base) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return true } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

async function startServer({ dataDir, port, username = adminUsername, password = adminPassword, extraEnv = {} }) {
  const base = `http://127.0.0.1:${port}`
  const child = spawn(serverRuntime, ['.output/server/index.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      ADMIN_USERNAME: username,
      ADMIN_PASSWORD: password,
      PORT: String(port),
      JWT_SECRET: randomBytes(32).toString('hex'),
      SHARE_SECRET: randomBytes(32).toString('hex'),
      DATABASE_PATH: join(dataDir, 'serangkai.db'),
      STORAGE_PATH: join(dataDir, 'files'),
      ...extraEnv,
    },
    stdio: 'ignore',
  })
  return { child, base }
}

async function stop(child) {
  if (!child) return
  child.kill('SIGTERM')
  await new Promise(resolve => child.once('exit', resolve))
}

async function withServer(options, run) {
  const { child, base } = await startServer(options)
  try {
    assert.equal(await waitForHealth(base), true, `${options.label || 'test'} server did not become healthy`)
    return await run(base)
  } finally {
    await stop(child)
  }
}

async function countUsers(databasePath) {
  const { Database } = await import('bun:sqlite')
  const db = new Database(databasePath)
  try { return db.query('SELECT COUNT(*) AS n FROM users').get().n } finally { db.close() }
}

test('owner credentials and identity survive restarts, and rotations take effect', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'serangkai-auth-rotate-'))
  const port = basePort
  try {
    let ownerId
    let token
    await withServer({ dataDir, port }, async (base) => {
      const { cookie, user } = await login(base)
      ownerId = user.id
      token = (await (await fetch(`${base}/api/tokens`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'persisted', scopes: ['read'] }),
      })).json()).token
      await fetch(`${base}/api/rangka`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Persisted rangka', type: 'markdown', content: '# Persisted' }),
      })
    })

    await withServer({ dataDir, port }, async (base) => {
      const { cookie, user } = await login(base)
      assert.equal(user.id, ownerId, 'owner identity must be stable')
      const list = await (await fetch(`${base}/api/rangka`, { headers: { cookie } })).json()
      assert.equal(list.rangka[0].title, 'Persisted rangka')
      assert.equal((await fetch(`${base}/api/rangka`, { headers: { authorization: `Bearer ${token}` } })).status, 200)
    })

    await withServer({ dataDir, port, password: 'rotated password 123' }, async (base) => {
      assert.equal((await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      })).status, 401, 'the old password must stop working')
      const { user } = await login(base, adminUsername, 'rotated password 123')
      assert.equal(user.id, ownerId)
    })

    await withServer({ dataDir, port, username: 'renamed-owner', password: 'rotated password 123' }, async (base) => {
      assert.equal((await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: 'rotated password 123' }),
      })).status, 401, 'the old username must stop working')
      const { user } = await login(base, 'renamed-owner', 'rotated password 123')
      assert.equal(user.id, ownerId, 'renaming must not create a new identity')
    })
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('an existing single-user database is adopted without losing data', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'serangkai-auth-legacy-'))
  const port = basePort + 1
  const databasePath = join(dataDir, 'serangkai.db')
  try {
    const { Database } = await import('bun:sqlite')
    const db = new Database(databasePath)
    db.exec(`CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`)
    db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)')
      .run('legacy-owner', 'legacy@example.com', bcrypt.hashSync('old legacy password', 10))
    db.close()

    await withServer({ dataDir, port, username: 'owner', password: 'new owner password' }, async (base) => {
      const { user } = await login(base, 'owner', 'new owner password')
      assert.equal(user.id, 'legacy-owner', 'the legacy account keeps its id')
      const old = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password: 'old legacy password' }),
      })
      assert.equal(old.status, 401, 'the environment password becomes authoritative')
      const created = await fetch(`${base}/api/rangka`, {
        method: 'POST',
        headers: { cookie: (await login(base, 'owner', 'new owner password')).cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Adopted rangka', type: 'markdown', content: '# ok' }),
      })
      assert.equal(created.status, 200)
    })
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('a multi-user database fails safely unless an owner is chosen explicitly', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'serangkai-auth-multi-'))
  const port = basePort + 2
  const databasePath = join(dataDir, 'serangkai.db')
  try {
    let ownerId
    await withServer({ dataDir, port, label: 'multi:create-owner' }, async (base) => {
      const { user } = await login(base)
      ownerId = user.id
    })
    await seedUser(databasePath, { id: 'second-owner', username: 'second' })

    const blocked = await startServer({ dataDir, port })
    let response
    for (let i = 0; i < 60; i++) {
      try { response = await fetch(`${blocked.base}/api/health`); break } catch {}
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(response, 'the ambiguous database did not start at all')
    assert.equal(response.status, 500, 'an ambiguous database must not serve requests')
    const body = await response.json()
    assert.match(body.message, /contains 2 users/)
    assert.match(body.message, /SERANGKAI_MIGRATION_OWNER_USER_ID/)
    await stop(blocked.child)

    await withServer({ dataDir, port, label: 'multi:explicit-migration', extraEnv: { SERANGKAI_MIGRATION_OWNER_USER_ID: ownerId } }, async (base) => {
      const { user } = await login(base)
      assert.equal(user.id, ownerId)
      const secondary = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'second', password: adminPassword }),
      })
      assert.equal(secondary.status, 401, 'non-owner accounts are excluded from authentication')
      assert.equal(await countUsers(databasePath), 2, 'no user row is deleted')
    })

    // The migration variable is a one-time choice: the disabled account keeps
    // its rows, and later restarts adopt the single active username without it.
    await withServer({ dataDir, port, label: 'multi:restart-without-var' }, async (base) => {
      const { user } = await login(base)
      assert.equal(user.id, ownerId)
    })
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('concurrent first requests create exactly one owner', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'serangkai-auth-race-'))
  const port = basePort + 3
  const databasePath = join(dataDir, 'serangkai.db')
  try {
    await withServer({ dataDir, port }, async (base) => {
      await Promise.all(Array.from({ length: 12 }, () => fetch(`${base}/api/health`).catch(() => null)))
      assert.equal(await countUsers(databasePath), 1)
      const ok = await login(base)
      assert.equal(ok.user.username, adminUsername)
    })
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})
