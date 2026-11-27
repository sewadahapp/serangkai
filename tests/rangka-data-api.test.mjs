import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 3880 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookie, writeToken, readToken

const request = (method, path, body, headers = { cookie }) => fetch(`${base}${path}`, {
  method,
  headers: { ...headers, 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const json = async (method, path, body, headers) => {
  const response = await request(method, path, body, headers)
  return { status: response.status, body: await response.json().catch(() => null) }
}
const createHtml = async (title = 'Board', visibility = 'private') => {
  const response = await json('POST', '/api/rangka', { title, type: 'html', content: '<!doctype html><html><head><title>Board</title></head><body><div id="board"></div></body></html>', visibility })
  assert.equal(response.status, 200, JSON.stringify(response.body))
  return response.body.rangka
}
const usage = async () => (await json('GET', '/api/storage')).body.storage.usedBytes
const bearer = token => ({ authorization: `Bearer ${token}` })

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-data-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') },
    stdio: 'ignore',
  })
  let healthy = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  if (!healthy) throw new Error('Server did not become healthy before the rangka data test')
  cookie = (await login(base)).cookie
  writeToken = (await json('POST', '/api/tokens', { name: 'data-write', scopes: ['read', 'write'] })).body.token
  readToken = (await json('POST', '/api/tokens', { name: 'data-read', scopes: ['read'] })).body.token
  assert.ok(writeToken && readToken)
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('the owner creates, lists, merges, reads, and deletes documents', async () => {
  const rangka = await createHtml()
  const path = `/api/rangka/${rangka.id}/data`

  const set = await json('PUT', `${path}/cards/c1`, { data: { title: 'Write notes', column: 'todo', order: 0 } })
  assert.equal(set.status, 200, JSON.stringify(set.body))
  assert.deepEqual(set.body.document.data, { title: 'Write notes', column: 'todo', order: 0 })
  assert.equal(set.body.document.updatedBy, 'owner')
  await json('PUT', `${path}/cards/c2`, { data: { title: 'Record demo', column: 'todo', order: 1 } })

  const listed = await json('GET', `${path}/cards`)
  assert.deepEqual(listed.body.documents.map(doc => doc.id), ['c1', 'c2'])

  const merged = await json('PATCH', `${path}/cards/c1`, { data: { column: 'done' } })
  assert.deepEqual(merged.body.document.data, { title: 'Write notes', column: 'done', order: 0 })
  assert.deepEqual((await json('GET', `${path}/cards/c1`)).body.document.data.column, 'done')

  // A merge into a missing document creates it.
  assert.equal((await json('PATCH', `${path}/notes/n1`, { data: { text: 'hello' } })).status, 200)
  const collections = await json('GET', path)
  assert.deepEqual(collections.body.collections.map(({ name, count }) => ({ name, count })), [{ name: 'cards', count: 2 }, { name: 'notes', count: 1 }])

  assert.deepEqual((await json('DELETE', `${path}/cards/c2`)).body, { deleted: true })
  assert.deepEqual((await json('DELETE', `${path}/cards/c2`)).body, { deleted: false })
  assert.equal((await json('GET', `${path}/cards/c2`)).status, 404)
})

test('data writes never create versions', async () => {
  const rangka = await createHtml('No versions')
  for (let i = 0; i < 3; i++) await json('PUT', `/api/rangka/${rangka.id}/data/cards/c1`, { data: { order: i } })
  const versions = await json('GET', `/api/rangka/${rangka.id}/versions`)
  assert.equal(versions.body.versions.length, 1)
})

test('names, shapes, and sizes are validated', async () => {
  const rangka = await createHtml('Validation')
  const path = `/api/rangka/${rangka.id}/data`
  assert.equal((await json('PUT', `${path}/bad.name/c1`, { data: {} })).status, 400)
  assert.equal((await json('PUT', `${path}/cards/${'x'.repeat(65)}`, { data: {} })).status, 400)
  assert.equal((await json('PUT', `${path}/cards/c1`, { data: [1, 2] })).status, 400)
  assert.equal((await json('PUT', `${path}/cards/c1`, { data: 'text' })).status, 400)
  assert.equal((await json('PUT', `${path}/cards/c1`, { value: {} })).status, 400)
  // Over the 64 KB document limit, but under the body cap.
  assert.equal((await json('PUT', `${path}/cards/c1`, { data: { text: 'a'.repeat(65 * 1024) } })).status, 413)
  // Far over the body cap is cut off while reading.
  assert.equal((await json('PUT', `${path}/cards/c1`, { data: { text: 'a'.repeat(200 * 1024) } })).status, 413)
})

test('tokens need read to read and write to write; other rangka are not found', async () => {
  const rangka = await createHtml('Scopes')
  const path = `/api/rangka/${rangka.id}/data/cards/c1`
  const written = await json('PUT', path, { data: { title: 'From agent' } }, bearer(writeToken))
  assert.equal(written.status, 200)
  assert.equal(written.body.document.updatedBy, 'agent')
  assert.equal((await json('GET', path, undefined, bearer(readToken))).status, 200)
  assert.equal((await json('PUT', path, { data: { title: 'Nope' } }, bearer(readToken))).status, 403)
  assert.equal((await json('DELETE', path, undefined, bearer(readToken))).status, 403)
  assert.equal((await json('GET', path, undefined, {})).status, 401)
  assert.equal((await json('GET', '/api/rangka/missing-rangka/data/cards')).status, 404)
})

test('data counts toward storage and is removed with its rangka', async () => {
  const rangka = await createHtml('Storage')
  const before = await usage()
  const data = { text: 'x'.repeat(1000) }
  await json('PUT', `/api/rangka/${rangka.id}/data/cards/c1`, { data })
  const size = Buffer.byteLength(JSON.stringify(data))
  assert.equal(await usage(), before + size)

  // Replacing a document counts the new size, not both.
  await json('PUT', `/api/rangka/${rangka.id}/data/cards/c1`, { data: { text: 'y' } })
  assert.equal(await usage(), before + Buffer.byteLength(JSON.stringify({ text: 'y' })))

  await json('PUT', `/api/rangka/${rangka.id}/data/cards/c1`, { data })
  const beforeDelete = await usage()
  assert.equal(beforeDelete, before + size)
  assert.equal((await json('DELETE', `/api/rangka/${rangka.id}`)).status, 200)
  assert.ok(await usage() <= beforeDelete - size)
})

test('shared pages read data under the share rules and cannot write', async () => {
  const priv = await createHtml('Private board')
  await json('PUT', `/api/rangka/${priv.id}/data/cards/c1`, { data: { title: 'secret' } })
  assert.equal((await json('GET', `/api/share-data/${priv.slug}/cards`, undefined, {})).status, 403)

  const pub = await createHtml('Public board', 'public')
  await json('PUT', `/api/rangka/${pub.id}/data/cards/c1`, { data: { title: 'hello' } })
  const listed = await json('GET', `/api/share-data/${pub.slug}/cards`, undefined, {})
  assert.equal(listed.status, 200)
  assert.equal(listed.body.documents[0].data.title, 'hello')
  assert.equal((await json('GET', `/api/share-data/${pub.slug}/cards/c1`, undefined, {})).body.document.id, 'c1')
  assert.equal((await json('GET', `/api/share-data/${pub.slug}/cards/c9`, undefined, {})).status, 404)
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const response = await request(method, `/api/share-data/${pub.slug}/cards/c1`, { data: { title: 'vandal' } }, {})
    assert.ok([404, 405].includes(response.status), `${method} returned ${response.status}`)
  }
  assert.equal((await json('GET', `/api/rangka/${pub.id}/data/cards/c1`)).body.document.data.title, 'hello')

  const unlisted = await createHtml('Unlisted board', 'unlisted')
  await json('PUT', `/api/rangka/${unlisted.id}/data/cards/c1`, { data: { title: 'link only' } })
  assert.equal((await json('GET', `/api/share-data/${unlisted.slug}/cards`, undefined, {})).status, 404)
  const { url } = (await json('POST', `/api/rangka/${unlisted.id}/share`)).body
  const key = new URL(url, base).searchParams.get('k')
  const keyed = await json('GET', `/api/share-data/${unlisted.slug}/cards?k=${encodeURIComponent(key)}`, undefined, {})
  assert.equal(keyed.status, 200)
  assert.equal(keyed.body.documents[0].data.title, 'link only')
})

test('HTML delivery injects the data bridge before the rangka scripts', async () => {
  const rangka = await createHtml('Bridge', 'public')
  const preview = await (await request('GET', `/api/rangka/${rangka.id}/preview`)).text()
  assert.match(preview, /<head[^>]*><script data-serangkai-data-bridge>/)
  assert.match(preview, /serangkai:data-result/)
  const shared = await (await fetch(`${base}/api/share/${rangka.slug}`, { headers: { 'sec-fetch-dest': 'iframe' } })).text()
  assert.match(shared, /data-serangkai-data-bridge/)
})
