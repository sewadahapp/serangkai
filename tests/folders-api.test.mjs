import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'

const port = 3660 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookieA, cookieB

const register = async (prefix) => {
  const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${prefix}-${randomBytes(3).toString('hex')}@example.com`, password: 'correct horse battery' }) })
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie')
}

const json = (cookie, method, path, body) => fetch(`${base}${path}`, { method, headers: { cookie, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-folder-test-'))
  child = spawn('node', ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  let healthy = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  if (!healthy) throw new Error('Server did not become healthy before the folder test')
  cookieA = await register('folder-a')
  cookieB = await register('folder-b')
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('folders nest with paths and artifacts can be created and moved inside them', async () => {
  const created = await json(cookieA, 'POST', '/api/folders', { name: 'Parent' })
  assert.equal(created.status, 200)
  const parent = (await created.json()).folder
  assert.equal(parent.path, '/Parent')

  const childResponse = await json(cookieA, 'POST', '/api/folders', { name: 'Child', parentId: parent.id })
  assert.equal(childResponse.status, 200)
  const childFolder = (await childResponse.json()).folder
  assert.equal(childFolder.path, '/Parent/Child')
  assert.equal(childFolder.parentId, parent.id)

  const artifactResponse = await json(cookieA, 'POST', '/api/artifacts', { title: 'Nested artifact', type: 'markdown', content: '# Nested', folderId: childFolder.id })
  assert.equal(artifactResponse.status, 200)
  const artifact = (await artifactResponse.json()).artifact

  const read = await json(cookieA, 'GET', `/api/artifacts/${artifact.id}`)
  assert.equal((await read.json()).artifact.folderId, childFolder.id)

  const moved = await json(cookieA, 'PUT', `/api/artifacts/${artifact.id}`, { folderId: null })
  assert.equal(moved.status, 200)
  assert.equal((await moved.json()).artifact.folderId, null)
})

test('renames folder paths with descendants and refuses to delete non-empty folders', async () => {
  const parent = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Rename parent' })).json()).folder
  const childFolder = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Child', parentId: parent.id })).json()).folder
  const artifact = (await (await json(cookieA, 'POST', '/api/artifacts', { title: 'Folder content', type: 'markdown', content: '# Content', folderId: parent.id })).json()).artifact

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

  // The artifact is still safe after the refused deletes.
  assert.equal((await json(cookieA, 'GET', `/api/artifacts/${artifact.id}`)).status, 200)
})

test('rejects foreign parent folders, foreign artifact folders, and slash names', async () => {
  const parent = (await (await json(cookieA, 'POST', '/api/folders', { name: 'Private parent' })).json()).folder

  const foreignChild = await json(cookieB, 'POST', '/api/folders', { name: 'Sneaky', parentId: parent.id })
  assert.equal(foreignChild.status, 400)

  const foreignArtifact = await json(cookieB, 'POST', '/api/artifacts', { title: 'Sneaky', type: 'markdown', content: '# Sneaky', folderId: parent.id })
  assert.equal(foreignArtifact.status, 400)

  const ownArtifact = (await (await json(cookieB, 'POST', '/api/artifacts', { title: 'Own', type: 'markdown', content: '# Own' })).json()).artifact
  const foreignMove = await json(cookieB, 'PUT', `/api/artifacts/${ownArtifact.id}`, { folderId: parent.id })
  assert.equal(foreignMove.status, 400)

  const slashName = await json(cookieA, 'POST', '/api/folders', { name: 'Bad/Name' })
  assert.equal(slashName.status, 400)
})
