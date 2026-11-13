import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login, seedUser } from './helpers/auth.mjs'

const port = 3660 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookieA, cookieB

const json = (cookie, method, path, body) => fetch(`${base}${path}`, { method, headers: { cookie, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-folder-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  let healthy = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  if (!healthy) throw new Error('Server did not become healthy before the folder test')
  cookieA = (await login(base)).cookie
  // A second account is seeded directly to exercise cross-owner isolation.
  // The owner bootstrap has already resolved, so the extra row is not treated
  // as an ambiguous migration.
  await seedUser(join(dataDir, 'serangkai.db'), { id: 'user-folder-b', username: 'other' })
  cookieB = (await login(base, 'other')).cookie
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('folders nest with paths and rangka can be created and moved inside them', async () => {
  const created = await json(cookieA, 'POST', '/api/folders', { name: 'Parent' })
  assert.equal(created.status, 200)
  const parent = (await created.json()).folder
  assert.equal(parent.path, '/Parent')

  const childResponse = await json(cookieA, 'POST', '/api/folders', { name: 'Child', parentId: parent.id })
  assert.equal(childResponse.status, 200)
  const childFolder = (await childResponse.json()).folder
  assert.equal(childFolder.path, '/Parent/Child')
  assert.equal(childFolder.parentId, parent.id)

  const rangkaResponse = await json(cookieA, 'POST', '/api/rangka', { title: 'Nested rangka', type: 'markdown', content: '# Nested', folderId: childFolder.id })
  assert.equal(rangkaResponse.status, 200)
  const rangka = (await rangkaResponse.json()).rangka

  const read = await json(cookieA, 'GET', `/api/rangka/${rangka.id}`)
  assert.equal((await read.json()).rangka.folderId, childFolder.id)

  const moved = await json(cookieA, 'PUT', `/api/rangka/${rangka.id}`, { folderId: null })
  assert.equal(moved.status, 200)
  assert.equal((await moved.json()).rangka.folderId, null)
})

test('moves folders, rewrites descendant paths, and rejects cycles', async () => {
  const a = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Move A' })).json()).folder
  const b = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Move B' })).json()).folder
  const c = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Move C', parentId: b.id })).json()).folder

  const moved = await json(cookieA, 'PUT', `/api/folders/${b.id}`, { parentId: a.id })
  assert.equal(moved.status, 200)
  assert.equal((await moved.json()).folder.path, '/Move A/Move B')

  const after = (await (await json(cookieA, 'GET', '/api/folders')).json()).folders
  assert.equal(after.find(folder => folder.id === c.id).path, '/Move A/Move B/Move C')
  assert.equal(after.find(folder => folder.id === b.id).parentId, a.id)

  assert.equal((await json(cookieA, 'PUT', `/api/folders/${b.id}`, { parentId: b.id })).status, 400)
  assert.equal((await json(cookieA, 'PUT', `/api/folders/${a.id}`, { parentId: c.id })).status, 400)
  assert.equal((await json(cookieA, 'PUT', `/api/folders/${a.id}`, { parentId: 'does-not-exist' })).status, 400)
  assert.equal((await json(cookieB, 'PUT', `/api/folders/${b.id}`, { parentId: null })).status, 404)

  const toRoot = await json(cookieA, 'PUT', `/api/folders/${b.id}`, { parentId: null })
  assert.equal((await toRoot.json()).folder.path, '/Move B')
  const rooted = (await (await json(cookieA, 'GET', '/api/folders')).json()).folders
  assert.equal(rooted.find(folder => folder.id === c.id).path, '/Move B/Move C')

  const renamedAndMoved = await json(cookieA, 'PUT', `/api/folders/${b.id}`, { name: 'Move B2', parentId: a.id })
  assert.equal((await renamedAndMoved.json()).folder.path, '/Move A/Move B2')
})

test('search can be scoped to a folder subtree', async () => {
  const parent = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Search parent' })).json()).folder
  const child = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Search child', parentId: parent.id })).json()).folder
  const sibling = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Search sibling' })).json()).folder

  for (const [title, folderId] of [['Alpha parent', parent.id], ['Alpha child', child.id], ['Alpha sibling', sibling.id], ['Alpha root', undefined]]) {
    const response = await json(cookieA, 'POST', '/api/rangka', { title, type: 'markdown', content: '# Alpha', ...(folderId ? { folderId } : {}) })
    assert.equal(response.status, 200)
  }

  const all = await json(cookieA, 'GET', '/api/search?q=Alpha')
  assert.equal((await all.json()).rangka.length, 4)

  const parentScope = await json(cookieA, 'GET', `/api/search?q=Alpha&folderId=${parent.id}`)
  const parentTitles = (await parentScope.json()).rangka.map(rangka => rangka.title).sort()
  assert.deepEqual(parentTitles, ['Alpha child', 'Alpha parent'])

  const childScope = await json(cookieA, 'GET', `/api/search?q=Alpha&folderId=${child.id}`)
  assert.deepEqual((await childScope.json()).rangka.map(rangka => rangka.title), ['Alpha child'])

  assert.equal((await json(cookieB, 'GET', `/api/search?q=Alpha&folderId=${parent.id}`)).status, 404)
})

test('renames folder paths with descendants and refuses to delete non-empty folders', async () => {
  const parent = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Rename parent' })).json()).folder
  const childFolder = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Child', parentId: parent.id })).json()).folder
  const rangka = (await (await json(cookieA, 'POST', '/api/rangka', { title: 'Folder content', type: 'markdown', content: '# Content', folderId: parent.id })).json()).rangka

  const renamed = await json(cookieA, 'PUT', `/api/folders/${parent.id}`, { name: 'Renamed parent' })
  assert.equal(renamed.status, 200)
  assert.equal((await renamed.json()).folder.path, '/Renamed parent')

  const folders = (await (await json(cookieA, 'GET', '/api/folders')).json()).folders
  assert.equal(folders.find(folder => folder.id === childFolder.id).path, '/Renamed parent/Child')

  const blocked = await json(cookieA, 'DELETE', `/api/folders/${parent.id}`)
  assert.equal(blocked.status, 409)
  assert.match((await blocked.json()).message, /not empty/)

  assert.equal((await json(cookieA, 'DELETE', `/api/folders/${childFolder.id}`)).status, 200)
  assert.equal((await json(cookieA, 'DELETE', `/api/folders/${parent.id}`)).status, 409)

  const slashRename = await json(cookieA, 'PUT', `/api/folders/${parent.id}`, { name: 'Bad/Name' })
  assert.equal(slashRename.status, 400)

  assert.equal((await json(cookieB, 'PUT', `/api/folders/${parent.id}`, { name: 'Stolen' })).status, 404)
  assert.equal((await json(cookieB, 'DELETE', `/api/folders/${parent.id}`)).status, 404)

  // The rangka is still safe after the refused deletes.
  assert.equal((await json(cookieA, 'GET', `/api/rangka/${rangka.id}`)).status, 200)
})

test('rejects foreign parent folders, foreign rangka folders, and slash names', async () => {
  const parent = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Private parent' })).json()).folder

  const foreignChild = await json(cookieB, 'POST', '/api/folders', { name: 'Sneaky', parentId: parent.id })
  assert.equal(foreignChild.status, 400)

  const foreignRangka = await json(cookieB, 'POST', '/api/rangka', { title: 'Sneaky', type: 'markdown', content: '# Sneaky', folderId: parent.id })
  assert.equal(foreignRangka.status, 400)

  const ownRangka = (await (await json(cookieB, 'POST', '/api/rangka', { title: 'Own', type: 'markdown', content: '# Own' })).json()).rangka
  const foreignMove = await json(cookieB, 'PUT', `/api/rangka/${ownRangka.id}`, { folderId: parent.id })
  assert.equal(foreignMove.status, 400)

  const slashName = await json(cookieA, 'POST', '/api/folders', { name: 'Bad/Name' })
  assert.equal(slashName.status, 400)
})

test('workspace paginates and scopes results while preserving total folder counts', async () => {
  const parent = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Pagination parent' })).json()).folder
  const childFolder = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Pagination child', parentId: parent.id })).json()).folder
  for (let i = 0; i < 27; i++) {
    const response = await json(cookieA, 'POST', '/api/rangka', { title: `Pagination example ${i}`, type: 'markdown', content: '# Example', folderId: i % 2 ? parent.id : childFolder.id })
    assert.equal(response.status, 200)
  }
  const path = `/api/workspace?folderId=${parent.id}&q=Pagination%20example`
  const first = await (await json(cookieA, 'GET', `${path}&page=1`)).json()
  const second = await (await json(cookieA, 'GET', `${path}&page=2`)).json()
  assert.equal(first.total, 27)
  assert.equal(first.rangka.length, 25)
  assert.equal(second.rangka.length, 2)
  assert.equal(new Set([...first.rangka, ...second.rangka].map(item => item.id)).size, 27)
  assert.equal(first.counts.find(row => row.folderId === childFolder.id).value, 14)
  assert.equal((await (await json(cookieA, 'GET', `${path}&page=99`)).json()).page, 2)
  assert.equal((await json(cookieB, 'GET', `/api/workspace?folderId=${parent.id}`)).status, 404)
  assert.equal((await fetch(`${base}/api/workspace`)).status, 401)
  assert.equal((await json(cookieA, 'GET', '/api/workspace?page=0')).status, 400)
})
