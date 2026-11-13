import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { ZipFile } from 'yazl'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login, seedUser } from './helpers/auth.mjs'

const port = 3860 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookieA, cookieB, userIdA

function zip(entries) {
  return new Promise((resolve, reject) => { const archive = new ZipFile(); const chunks = []; archive.outputStream.on('data', chunk => chunks.push(chunk)); archive.outputStream.on('end', () => resolve(Buffer.concat(chunks))); archive.outputStream.on('error', reject); for (const [name, content] of entries) archive.addBuffer(Buffer.from(content), name); archive.end() })
}

async function filesUnder(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]))
    return nested.flat()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

const latestVersionOf = async (id, cookie = cookieA) => {
  const res = await fetch(`${base}/api/rangka/${id}/versions`, { headers: { cookie } })
  const body = await res.json()
  return body.versions?.[0]?.version ?? 0
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-lifecycle-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  let healthy = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  if (!healthy) throw new Error('Server did not become healthy before the lifecycle test')
  const a = await login(base)
  cookieA = a.cookie
  userIdA = a.user.id
  // Seed a second account for cross-owner checks. The owner bootstrap has
  // already chosen the environment-configured owner by now.
  await seedUser(join(dataDir, 'serangkai.db'), { id: 'user-lifecycle-b', username: 'other' })
  cookieB = (await login(base, 'other')).cookie
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('deletes a rangka, its versions, and its stored files', async () => {
  const created = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Disposable', type: 'markdown', content: '# One' }) })
  const rangka = (await created.json()).rangka
  const updated = await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(rangka.id), content: '# Two' }) })
  assert.equal(updated.status, 200)

  const stored = await filesUnder(join(dataDir, 'files', userIdA, rangka.id))
  assert.ok(stored.length >= 2, `expected content plus version files, got ${stored.length}`)

  const foreign = await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'DELETE', headers: { cookie: cookieB } })
  assert.equal(foreign.status, 404)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie: cookieA } })).status, 200)

  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'DELETE', headers: { cookie: cookieA } })).status, 200)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie: cookieA } })).status, 404)
  assert.deepEqual(await filesUnder(join(dataDir, 'files', userIdA, rangka.id)), [])
})

test('uploaded rangka validate folder ownership', async () => {
  const folder = (await (await fetch(`${base}/api/folders`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Upload target' }) })).json()).folder

  const formA = new FormData()
  formA.append('file', new Blob(['# Uploaded'], { type: 'text/markdown' }), 'upload.md')
  formA.append('folderId', folder.id)
  const owned = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie: cookieA }, body: formA })
  assert.equal(owned.status, 200)
  const rangka = (await owned.json()).rangka
  assert.equal(rangka.folderId, folder.id)
  const read = await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie: cookieA } })
  assert.equal((await read.json()).rangka.folderId, folder.id)

  const formB = new FormData()
  formB.append('file', new Blob(['# Uploaded'], { type: 'text/markdown' }), 'upload.md')
  formB.append('folderId', folder.id)
  const foreign = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie: cookieB }, body: formB })
  assert.equal(foreign.status, 400)
})

test('previews images and PDFs inline for the owner only', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
  const imageForm = new FormData()
  imageForm.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png')
  imageForm.append('title', 'Pixel')
  const imageUpload = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie: cookieA }, body: imageForm })
  assert.equal(imageUpload.status, 200)
  const image = (await imageUpload.json()).rangka

  const preview = await fetch(`${base}/api/rangka/${image.id}/preview`, { headers: { cookie: cookieA } })
  assert.equal(preview.status, 200)
  assert.equal(preview.headers.get('content-type'), 'image/png')
  assert.match(preview.headers.get('content-security-policy'), /sandbox/)
  assert.match(preview.headers.get('content-disposition'), /^inline/)
  assert.equal(preview.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), png)

  assert.equal((await fetch(`${base}/api/rangka/${image.id}/preview`)).status, 401)
  assert.equal((await fetch(`${base}/api/rangka/${image.id}/preview`, { headers: { cookie: cookieB } })).status, 404)

  const metadata = await fetch(`${base}/api/rangka/${image.id}`, { headers: { cookie: cookieA } })
  assert.equal((await metadata.json()).content, '')

  const pdfForm = new FormData()
  pdfForm.append('file', new Blob([Buffer.from('%PDF-1.4\n%%EOF')], { type: 'application/pdf' }), 'doc.pdf')
  const pdfUpload = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie: cookieA }, body: pdfForm })
  const pdf = (await pdfUpload.json()).rangka
  const pdfPreview = await fetch(`${base}/api/rangka/${pdf.id}/preview`, { headers: { cookie: cookieA } })
  assert.equal(pdfPreview.status, 200)
  assert.equal(pdfPreview.headers.get('content-type'), 'application/pdf')
  assert.equal(pdfPreview.headers.get('x-frame-options'), 'SAMEORIGIN')

  const text = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Text', type: 'markdown', content: '# Text' }) })
  const textRangka = (await text.json()).rangka
  assert.equal((await fetch(`${base}/api/rangka/${textRangka.id}/preview`, { headers: { cookie: cookieA } })).status, 400)
})

test('previews HTML rangka in a sandboxed frame for the owner only', async () => {
  const document = '<!DOCTYPE html><html><head><style>body{background:#2563eb}</style></head><body><h1>Preview me</h1></body></html>'
  const created = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'HTML doc', type: 'html', content: document }) })
  const rangka = (await created.json()).rangka

  const preview = await fetch(`${base}/api/rangka/${rangka.id}/preview`, { headers: { cookie: cookieA } })
  assert.equal(preview.status, 200)
  assert.match(preview.headers.get('content-type'), /text\/html/)
  const csp = preview.headers.get('content-security-policy')
  assert.match(csp, /sandbox allow-scripts/)
  assert.match(csp, /connect-src 'none'/)
  assert.match(csp, /form-action 'none'/)
  assert.match(csp, /style-src 'self' 'unsafe-inline'/)
  assert.doesNotMatch(csp, /allow-same-origin/)
  assert.match(await preview.text(), /Preview me/)

  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/preview`)).status, 401)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/preview`, { headers: { cookie: cookieB } })).status, 404)
})

test('reads and restores historical versions without rewriting history', async () => {
  const created = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Versioned', type: 'markdown', content: '# One' }) })
  const rangka = (await created.json()).rangka
  await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(rangka.id), content: '# Two' }) })

  const first = await fetch(`${base}/api/rangka/${rangka.id}/versions/1`, { headers: { cookie: cookieA } })
  assert.equal(first.status, 200)
  assert.equal((await first.json()).content, '# One')

  const second = await fetch(`${base}/api/rangka/${rangka.id}/versions/2`, { headers: { cookie: cookieA } })
  assert.equal((await second.json()).content, '# Two')

  const before = (await (await fetch(`${base}/api/rangka/${rangka.id}/versions`, { headers: { cookie: cookieA } })).json()).versions
  assert.deepEqual(before.map(version => version.version), [2, 1])

  const restored = await fetch(`${base}/api/rangka/${rangka.id}/versions/1/restore`, { method: 'POST', headers: { cookie: cookieA } })
  assert.equal(restored.status, 200)
  const restoreBody = await restored.json()
  assert.equal(restoreBody.version, 3)
  assert.equal(restoreBody.restoredFrom, 1)

  const current = await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie: cookieA } })
  assert.equal((await current.json()).content, '# One')

  const after = (await (await fetch(`${base}/api/rangka/${rangka.id}/versions`, { headers: { cookie: cookieA } })).json()).versions
  assert.deepEqual(after.map(version => version.version), [3, 2, 1])

  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions/99`, { headers: { cookie: cookieA } })).status, 404)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions/0`, { headers: { cookie: cookieA } })).status, 400)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions/abc`, { headers: { cookie: cookieA } })).status, 400)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions/99/restore`, { method: 'POST', headers: { cookie: cookieA } })).status, 404)

  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions/1`, { headers: { cookie: cookieB } })).status, 404)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions/1/restore`, { method: 'POST', headers: { cookie: cookieB } })).status, 404)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions/1`)).status, 401)

  const token = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'read only', scopes: ['read'] }) })
  const { token: readOnly } = await token.json()
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions/1/restore`, { method: 'POST', headers: { authorization: `Bearer ${readOnly}` } })).status, 403)
})

test('requires baseVersion for content writes and refuses stale ones', async () => {
  const created = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Guard', type: 'markdown', content: '# One' }) })
  const rangka = (await created.json()).rangka

  // Missing baseVersion is rejected outright.
  const missing = await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ content: '# No base' }) })
  assert.equal(missing.status, 400)
  assert.match((await missing.json()).message, /baseVersion is required/)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie: cookieA } })).ok, true)

  // Correct baseVersion publishes.
  const ok = await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: 1, content: '# Two' }) })
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).version, 2)

  // A writer still on version 1 is refused with 409 and nothing is written.
  const stale = await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: 1, content: '# Stale' }) })
  assert.equal(stale.status, 409)
  const staleBody = await stale.json()
  assert.match(staleBody.message, /Stale write refused/)
  assert.equal(staleBody.data.currentVersion, 2)
  const afterStale = await (await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie: cookieA } })).json()
  assert.equal(afterStale.content, '# Two')

  // Metadata-only edits stay exempt so the UI can rename without a version.
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Renamed' }) })).status, 200)

  // Restoring a specific version stays exempt: it names its target explicitly.
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/versions/1/restore`, { method: 'POST', headers: { cookie: cookieA } })).status, 200)
  const restored = await (await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie: cookieA } })).json()
  assert.equal(restored.content, '# One')
})

test('concurrent writes on the same baseVersion publish exactly one version', async () => {
  const created = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Race', type: 'markdown', content: '# Base' }) })
  const rangka = (await created.json()).rangka

  const write = content => fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: 1, content }) })
  const contents = Array.from({ length: 6 }, (_, index) => `# Writer ${index}`)
  const responses = await Promise.all(contents.map(write))
  const statuses = responses.map(response => response.status)

  // One writer wins; every other one is a retryable 409, never a 500.
  assert.equal(statuses.filter(status => status === 200).length, 1, `statuses: ${statuses}`)
  assert.equal(statuses.filter(status => status === 409).length, contents.length - 1, `statuses: ${statuses}`)
  const winner = contents[statuses.indexOf(200)]

  // The losers must not have overwritten the winner's stored bytes.
  const version2 = await (await fetch(`${base}/api/rangka/${rangka.id}/versions/2`, { headers: { cookie: cookieA } })).json()
  assert.equal(version2.content, winner)
  const current = await (await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie: cookieA } })).json()
  assert.equal(current.content, winner)
  assert.equal(await latestVersionOf(rangka.id), 2)
})

test('does not record a version when content is unchanged', async () => {
  const created = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'No-op writes', type: 'markdown', content: '# Stable' }) })
  const rangka = (await created.json()).rangka

  const versions = async () => (await (await fetch(`${base}/api/rangka/${rangka.id}/versions`, { headers: { cookie: cookieA } })).json()).versions

  // Rewriting the identical content must not append history.
  const noop = await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(rangka.id), content: '# Stable' }) })
  assert.equal(noop.status, 200)
  const noopBody = await noop.json()
  assert.equal(noopBody.versionCreated, false)
  assert.deepEqual((await versions()).map(v => v.version), [1])

  // Title-only changes also create no version.
  await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Renamed only' }) })
  assert.deepEqual((await versions()).map(v => v.version), [1])

  // A real change still appends exactly one version.
  const changed = await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(rangka.id), content: '# Changed' }) })
  assert.equal((await changed.json()).versionCreated, true)
  assert.deepEqual((await versions()).map(v => v.version), [2, 1])

  // Restoring the previous bytes is a real change, so it appends too.
  await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(rangka.id), content: '# Stable' }) })
  assert.deepEqual((await versions()).map(v => v.version), [3, 2, 1])
})

test('duplicates rangka as private copies with the current content', async () => {
  const created = await fetch(`${base}/api/rangka`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Original', type: 'markdown', content: '# Original', visibility: 'public' }) })
  const rangka = (await created.json()).rangka
  await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(rangka.id), content: '# Revised' }) })

  const duplicate = await fetch(`${base}/api/rangka/${rangka.id}/duplicate`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Copy of original' }) })
  assert.equal(duplicate.status, 200)
  const copy = (await duplicate.json()).rangka
  assert.notEqual(copy.id, rangka.id)
  assert.equal(copy.title, 'Copy of original')
  assert.equal(copy.visibility, 'private')

  const read = await fetch(`${base}/api/rangka/${copy.id}`, { headers: { cookie: cookieA } })
  const body = await read.json()
  assert.equal(body.content, '# Revised')
  assert.equal(body.rangka.folderId, null)

  const versions = await fetch(`${base}/api/rangka/${copy.id}/versions`, { headers: { cookie: cookieA } })
  assert.deepEqual((await versions.json()).versions.map(version => version.version), [1])

  const defaultTitle = await fetch(`${base}/api/rangka/${rangka.id}/duplicate`, { method: 'POST', headers: { cookie: cookieA } })
  assert.equal((await defaultTitle.json()).rangka.title, 'Original (copy)')

  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/duplicate`, { method: 'POST', headers: { cookie: cookieB } })).status, 404)
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/duplicate`, { method: 'POST' })).status, 401)

  const token = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'reader', scopes: ['read'] }) })
  const { token: readOnly } = await token.json()
  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}/duplicate`, { method: 'POST', headers: { authorization: `Bearer ${readOnly}` } })).status, 403)
})

test('overview summarizes counts, visibility, storage, and recent rangka', async () => {
  const send = (cookie, method, path, body) => fetch(`${base}${path}`, { method, headers: { cookie, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const folder = (await (await send(cookieA, 'POST', '/api/folders', { name: 'Overview folder' })).json()).folder
  await send(cookieA, 'POST', '/api/rangka', { title: 'Overview public', type: 'markdown', content: '# A', visibility: 'public', folderId: folder.id })
  await send(cookieA, 'POST', '/api/rangka', { title: 'Overview unlisted', type: 'markdown', content: '# B', visibility: 'unlisted' })

  const form = new FormData()
  form.append('file', new Blob([Buffer.from('x'.repeat(2048))], { type: 'application/pdf' }), 'overview.pdf')
  form.append('title', 'Overview pdf')
  assert.equal((await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie: cookieA }, body: form })).status, 200)

  const overview = await send(cookieA, 'GET', '/api/overview')
  const body = await overview.json()
  assert.ok(body.summary.rangka >= 3)
  assert.ok(body.summary.folders >= 1)
  assert.ok(body.summary.publicRangka >= 1)
  assert.ok(body.summary.unlistedRangka >= 1)
  assert.ok(body.summary.privateRangka >= 1)
  assert.ok(body.summary.totalBytes >= 2048)
  assert.ok(body.summary.byType.markdown >= 2)
  assert.ok(body.summary.byType.pdf >= 1)
  assert.ok(body.recent.length > 0)
  assert.ok(body.recent.every(rangka => !('contentPath' in rangka) && !('userId' in rangka)))
  assert.ok(body.recent.some(rangka => rangka.title === 'Overview pdf'))

  assert.equal((await fetch(`${base}/api/overview`)).status, 401)
  const other = await (await fetch(`${base}/api/overview`, { headers: { cookie: cookieB } })).json()
  assert.equal(other.summary.publicRangka, 0)
  assert.equal(other.recent.length, 0)
})

test('deletes extracted bundle files from the storage volume', async () => {
  const form = new FormData()
  form.append('file', new Blob([await zip([['index.html', '<h1>Temp bundle</h1>']])], { type: 'application/zip' }), 'temp.zip')
  form.append('title', 'Temp bundle')
  const upload = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie: cookieA }, body: form })
  assert.equal(upload.status, 200)
  const rangka = (await upload.json()).rangka
  const bundleDirectory = join(dataDir, 'files', userIdA, rangka.id, 'bundle')
  assert.ok((await filesUnder(bundleDirectory)).length > 0)

  assert.equal((await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'DELETE', headers: { cookie: cookieA } })).status, 200)
  assert.deepEqual(await filesUnder(bundleDirectory), [])
})

test('share identifiers are globally unique and cannot collide across users', async () => {
  // Two accounts ask for the same explicit slug. Share URLs resolve by slug
  // alone, so the second create must get a distinct identifier instead of
  // shadowing the first account's rangka.
  const create = (cookie, slug, content) => fetch(`${base}/api/rangka`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Shared Slug', type: 'markdown', content, visibility: 'public', slug }),
  })
  const rangkaA = (await (await create(cookieA, 'shared-slug', '# From A')).json()).rangka
  const rangkaB = (await (await create(cookieB, 'shared-slug', '# From B')).json()).rangka
  assert.notEqual(rangkaA.slug, rangkaB.slug, 'the two rangka must not share a public identifier')

  const json = await (await fetch(`${base}/api/share/shared-slug?format=json`)).json()
  assert.equal(json.title, 'Shared Slug', 'the original slug still resolves')

  // Titles that naturally collide also get a distinct suffix.
  const duplicate = (cookie) => fetch(`${base}/api/rangka`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Same title', type: 'markdown', content: '# Same', visibility: 'public' }),
  })
  const first = (await (await duplicate(cookieA)).json()).rangka
  const second = (await (await duplicate(cookieB)).json()).rangka
  assert.notEqual(first.slug, second.slug)
})

test('history pagination retains latest version and isolates owners', async () => {
  const headers = { cookie: cookieA, 'content-type': 'application/json' }
  const rangka = (await (await fetch(`${base}/api/rangka`, { method: 'POST', headers, body: JSON.stringify({ title: 'Long history', type: 'markdown', content: '# Version 1' }) })).json()).rangka
  for (let i = 2; i <= 11; i++) {
    const response = await fetch(`${base}/api/rangka/${rangka.id}`, { method: 'PUT', headers, body: JSON.stringify({ baseVersion: i - 1, content: `# Version ${i}` }) })
    assert.equal(response.status, 200)
  }
  const endpoint = `${base}/api/rangka/${rangka.id}/versions`
  const first = await (await fetch(`${endpoint}?page=1`, { headers })).json()
  const second = await (await fetch(`${endpoint}?page=2`, { headers })).json()
  assert.equal(first.total, 11)
  assert.equal(first.latestVersion, 11)
  assert.equal(second.latestVersion, 11)
  assert.deepEqual(first.versions.map(v => v.version), [11, 10, 9, 8, 7, 6, 5, 4])
  assert.deepEqual(second.versions.map(v => v.version), [3, 2, 1])
  assert.equal((await (await fetch(`${endpoint}?page=50`, { headers })).json()).page, 2)
  assert.equal((await fetch(`${endpoint}?page=0`, { headers })).status, 400)
  assert.equal((await fetch(`${endpoint}?page=1`, { headers: { cookie: cookieB } })).status, 404)
  assert.equal((await (await fetch(endpoint, { headers })).json()).versions.length, 11)
})
