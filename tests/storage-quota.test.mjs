import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'
import { formatByteSize, parseByteSize } from '../shared/byte-size.ts'

const port = 3770 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
// Operator cap for this server: 1 MB (decimal), always enforced.
const CAP = 1_000_000
let child, dataDir, cookie, ownerId

const request = (method, path, body, headers = { cookie }) => fetch(`${base}${path}`, {
  method,
  headers: { ...headers, 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const status = async () => (await (await request('GET', '/api/storage')).json()).storage
const setLimit = (limitBytes, mode) => request('PUT', '/api/storage', { limitBytes, mode })
const create = (content, title = 'Quota doc') => request('POST', '/api/rangka', { title, type: 'markdown', content })

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-quota-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, ...adminEnv(), PORT: String(port), STORAGE_LIMIT: '1MB', JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') },
    stdio: 'ignore',
  })
  let healthy = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  if (!healthy) throw new Error('Server did not become healthy before the storage quota test')
  const session = await login(base)
  cookie = session.cookie
  ownerId = session.user.id
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('byte sizes parse decimal and binary units and reject nonsense', () => {
  assert.equal(parseByteSize('10GB'), 10_000_000_000)
  assert.equal(parseByteSize('500 MB'), 500_000_000)
  assert.equal(parseByteSize('1.5GiB'), 1.5 * 1024 ** 3)
  assert.equal(parseByteSize('2048'), 2048)
  for (const bad of ['', 'ten', '10XB', '-5MB', '0', null, undefined]) assert.equal(parseByteSize(bad), null, String(bad))
  assert.equal(formatByteSize(1_234_567), '1.2 MB')
  assert.equal(formatByteSize(0), '0 B')
})

test('usage counts every stored version and drops when a rangka is deleted', async () => {
  const before = (await status()).usedBytes
  const created = await (await create('a'.repeat(1000))).json()
  assert.equal((await status()).usedBytes, before + 1000)

  // A new version is stored in full, so it adds its whole size.
  const updated = await request('PUT', `/api/rangka/${created.rangka.id}`, { content: 'b'.repeat(400), baseVersion: 1 })
  assert.equal(updated.status, 200)
  assert.equal((await status()).usedBytes, before + 1400)

  const removed = await request('DELETE', `/api/rangka/${created.rangka.id}`)
  assert.equal(removed.status, 200)
  assert.equal((await status()).usedBytes, before)
})

test('uploads count their file size', async () => {
  const before = (await status()).usedBytes
  const form = new FormData()
  form.append('file', new Blob(['x'.repeat(2500)], { type: 'text/markdown' }), 'upload.md')
  const uploaded = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie }, body: form })
  assert.equal(uploaded.status, 200)
  const { rangka } = await uploaded.json()
  assert.equal((await status()).usedBytes, before + 2500)
  await request('DELETE', `/api/rangka/${rangka.id}`)
})

test('reject mode refuses writes over the owner limit; warn mode allows them', async () => {
  const used = (await status()).usedBytes
  assert.equal((await setLimit(used + 500, 'reject')).status, 200)

  const refused = await create('c'.repeat(600))
  assert.equal(refused.status, 507)
  assert.match((await refused.json()).message, /Storage limit reached/)
  // A write that fits still works.
  const fits = await (await create('d'.repeat(100))).json()
  assert.ok(fits.rangka.id)

  // Deleting is always allowed, even at the limit.
  assert.equal((await request('DELETE', `/api/rangka/${fits.rangka.id}`)).status, 200)

  assert.equal((await setLimit(used + 500, 'warn')).status, 200)
  const warned = await (await create('e'.repeat(600))).json()
  assert.ok(warned.rangka.id, 'warn mode stores the write')
  const current = await status()
  assert.ok(current.usedBytes > current.limitBytes, 'usage may pass the owner limit in warn mode')
  await request('DELETE', `/api/rangka/${warned.rangka.id}`)
  assert.equal((await setLimit(null, 'warn')).status, 200)
})

test('the operator cap is always enforced, even in warn mode', async () => {
  const current = await status()
  assert.equal(current.operatorLimitBytes, CAP)
  assert.equal(current.mode, 'warn')
  // Going over by a single byte is refused...
  const refused = await create('f'.repeat(CAP - current.usedBytes + 1))
  assert.equal(refused.status, 507)
  assert.match((await refused.json()).message, /this server's/)
  // ...while landing exactly on the cap is allowed.
  const exact = await create('f'.repeat(CAP - current.usedBytes))
  assert.equal(exact.status, 200)
  await request('DELETE', `/api/rangka/${(await exact.json()).rangka.id}`)
})

test('the owner limit cannot exceed the cap or be changed with an API token', async () => {
  const tooHigh = await setLimit(CAP + 1, 'reject')
  assert.equal(tooHigh.status, 400)
  assert.equal((await status()).ownerLimitBytes, null)

  const minted = await (await request('POST', '/api/tokens', { name: 'Full agent', scopes: ['full'] })).json()
  const viaToken = await request('PUT', '/api/storage', { limitBytes: null, mode: 'warn' }, { authorization: `Bearer ${minted.token}` })
  assert.equal(viaToken.status, 401, 'even a full token cannot change storage settings')
  // Agents can still read usage.
  assert.equal((await request('GET', '/api/storage', undefined, { authorization: `Bearer ${minted.token}` })).status, 200)
})

test('versions written before accounting are measured by the backfill', async () => {
  const before = (await status()).usedBytes
  const id = `legacy-${randomBytes(4).toString('hex')}`
  const key = `${ownerId}/${id}/content`
  await mkdir(join(dataDir, 'files', ownerId, id), { recursive: true })
  await writeFile(join(dataDir, 'files', key), 'g'.repeat(777))

  const { Database } = await import('bun:sqlite')
  const sqlite = new Database(join(dataDir, 'serangkai.db'))
  try {
    const now = Math.floor(Date.now() / 1000)
    sqlite.prepare(`INSERT INTO rangka (id, user_id, slug, title, type, visibility, content_path, metadata, created_at, updated_at)
      VALUES (?, ?, ?, 'Legacy', 'markdown', 'private', ?, '{}', ?, ?)`).run(id, ownerId, id, key, now, now)
    sqlite.prepare(`INSERT INTO rangka_versions (id, rangka_id, version, content_path, metadata, stored_bytes, created_at)
      VALUES (?, ?, 1, ?, '{}', NULL, ?)`).run(`${id}-v1`, id, key, now)
  } finally {
    sqlite.close()
  }

  assert.equal((await status()).usedBytes, before + 777)
})

const exists = path => access(path).then(() => true, () => false)
const versionList = async id => (await (await request('GET', `/api/rangka/${id}/versions`)).json()).versions.map(item => item.version)
// Create a rangka, then save each later body as a new version (v1..vN).
async function withVersions(bodies, title = 'History doc') {
  const created = await (await create(bodies[0], title)).json()
  for (let index = 1; index < bodies.length; index++) {
    const saved = await request('PUT', `/api/rangka/${created.rangka.id}`, { content: bodies[index], baseVersion: index })
    assert.equal(saved.status, 200)
  }
  return created.rangka.id
}

test('deleting one version frees its bytes and file; the current version is refused', async () => {
  const before = (await status()).usedBytes
  const id = await withVersions(['a'.repeat(1000), 'b'.repeat(400), 'c'.repeat(300)])
  assert.equal((await status()).usedBytes, before + 1700)

  const firstFile = join(dataDir, 'files', ownerId, id, 'content')
  assert.equal(await exists(firstFile), true)
  const removed = await request('DELETE', `/api/rangka/${id}/versions/1`)
  assert.equal(removed.status, 200)
  assert.equal((await removed.json()).freedBytes, 1000)
  assert.equal(await exists(firstFile), false, 'the version file is removed')
  assert.equal((await status()).usedBytes, before + 700)
  assert.deepEqual(await versionList(id), [3, 2])

  assert.equal((await request('DELETE', `/api/rangka/${id}/versions/3`)).status, 409, 'the current version stays')
  assert.equal((await request('DELETE', `/api/rangka/${id}/versions/9`)).status, 404)
  // The rangka still reads its current content.
  assert.equal((await (await request('GET', `/api/rangka/${id}`)).json()).content, 'c'.repeat(300))

  const minted = await (await request('POST', '/api/tokens', { name: 'History agent', scopes: ['full'] })).json()
  const viaToken = await request('DELETE', `/api/rangka/${id}/versions/2`, undefined, { authorization: `Bearer ${minted.token}` })
  assert.equal(viaToken.status, 401, 'agents cannot erase history')
  assert.equal((await request('DELETE', `/api/rangka/${id}/versions`, undefined, { authorization: `Bearer ${minted.token}` })).status, 401)
  await request('DELETE', `/api/rangka/${id}`)
})

test('clearing older versions keeps only the current one', async () => {
  const before = (await status()).usedBytes
  const id = await withVersions(['a'.repeat(100), 'b'.repeat(200), 'c'.repeat(300), 'd'.repeat(50)])
  const cleared = await request('DELETE', `/api/rangka/${id}/versions`)
  assert.equal(cleared.status, 200)
  assert.deepEqual(await cleared.json(), { deleted: 3, freedBytes: 600, remaining: 0 })
  assert.deepEqual(await versionList(id), [4])
  assert.equal((await status()).usedBytes, before + 50)
  // Saving again continues numbering from the current version.
  assert.equal((await request('PUT', `/api/rangka/${id}`, { content: 'e', baseVersion: 4 })).status, 200)
  assert.deepEqual(await versionList(id), [5, 4])
  await request('DELETE', `/api/rangka/${id}`)
})

test('the keep-versions setting prunes older versions on save', async () => {
  const save = keepVersions => request('PUT', '/api/storage', { limitBytes: null, mode: 'warn', keepVersions })
  assert.equal((await save(0)).status, 400)
  assert.equal((await save(2)).status, 200)
  assert.equal((await status()).keepVersions, 2)
  // A client that omits keepVersions leaves it unchanged.
  assert.equal((await setLimit(null, 'warn')).status, 200)
  assert.equal((await status()).keepVersions, 2)

  try {
    const before = (await status()).usedBytes
    const id = await withVersions(['a'.repeat(100), 'b'.repeat(200), 'c'.repeat(300), 'd'.repeat(400)])
    assert.deepEqual(await versionList(id), [4, 3])
    assert.equal((await status()).usedBytes, before + 700)

    // Restoring creates a version too, and prunes the same way.
    const restored = await request('POST', `/api/rangka/${id}/versions/3/restore`)
    assert.equal(restored.status, 200)
    assert.deepEqual(await versionList(id), [5, 4])
    await request('DELETE', `/api/rangka/${id}`)
  } finally {
    assert.equal((await save(null)).status, 200)
  }
  const id = await withVersions(['a', 'b', 'c'])
  assert.deepEqual(await versionList(id), [3, 2, 1], 'keep all is the default again')
  await request('DELETE', `/api/rangka/${id}`)
})
