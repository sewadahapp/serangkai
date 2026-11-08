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
  const res = await fetch(`${base}/api/artifacts/${id}/versions`, { headers: { cookie } })
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

test('deletes an artifact, its versions, and its stored files', async () => {
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Disposable', type: 'markdown', content: '# One' }) })
  const artifact = (await created.json()).artifact
  const updated = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(artifact.id), content: '# Two' }) })
  assert.equal(updated.status, 200)

  const stored = await filesUnder(join(dataDir, 'files', userIdA, artifact.id))
  assert.ok(stored.length >= 2, `expected content plus version files, got ${stored.length}`)

  const foreign = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'DELETE', headers: { cookie: cookieB } })
  assert.equal(foreign.status, 404)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie: cookieA } })).status, 200)

  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'DELETE', headers: { cookie: cookieA } })).status, 200)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie: cookieA } })).status, 404)
  assert.deepEqual(await filesUnder(join(dataDir, 'files', userIdA, artifact.id)), [])
})

test('uploaded artifacts validate folder ownership', async () => {
  const folder = (await (await fetch(`${base}/api/folders`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Upload target' }) })).json()).folder

  const formA = new FormData()
  formA.append('file', new Blob(['# Uploaded'], { type: 'text/markdown' }), 'upload.md')
  formA.append('folderId', folder.id)
  const owned = await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie: cookieA }, body: formA })
  assert.equal(owned.status, 200)
  const artifact = (await owned.json()).artifact
  assert.equal(artifact.folderId, folder.id)
  const read = await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie: cookieA } })
  assert.equal((await read.json()).artifact.folderId, folder.id)

  const formB = new FormData()
  formB.append('file', new Blob(['# Uploaded'], { type: 'text/markdown' }), 'upload.md')
  formB.append('folderId', folder.id)
  const foreign = await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie: cookieB }, body: formB })
  assert.equal(foreign.status, 400)
})

test('previews images and PDFs inline for the owner only', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
  const imageForm = new FormData()
  imageForm.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png')
  imageForm.append('title', 'Pixel')
  const imageUpload = await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie: cookieA }, body: imageForm })
  assert.equal(imageUpload.status, 200)
  const image = (await imageUpload.json()).artifact

  const preview = await fetch(`${base}/api/artifacts/${image.id}/preview`, { headers: { cookie: cookieA } })
  assert.equal(preview.status, 200)
  assert.equal(preview.headers.get('content-type'), 'image/png')
  assert.match(preview.headers.get('content-security-policy'), /sandbox/)
  assert.match(preview.headers.get('content-disposition'), /^inline/)
  assert.equal(preview.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), png)

  assert.equal((await fetch(`${base}/api/artifacts/${image.id}/preview`)).status, 401)
  assert.equal((await fetch(`${base}/api/artifacts/${image.id}/preview`, { headers: { cookie: cookieB } })).status, 404)

  const metadata = await fetch(`${base}/api/artifacts/${image.id}`, { headers: { cookie: cookieA } })
  assert.equal((await metadata.json()).content, '')

  const pdfForm = new FormData()
  pdfForm.append('file', new Blob([Buffer.from('%PDF-1.4\n%%EOF')], { type: 'application/pdf' }), 'doc.pdf')
  const pdfUpload = await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie: cookieA }, body: pdfForm })
  const pdf = (await pdfUpload.json()).artifact
  const pdfPreview = await fetch(`${base}/api/artifacts/${pdf.id}/preview`, { headers: { cookie: cookieA } })
  assert.equal(pdfPreview.status, 200)
  assert.equal(pdfPreview.headers.get('content-type'), 'application/pdf')
  assert.equal(pdfPreview.headers.get('x-frame-options'), 'SAMEORIGIN')

  const text = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Text', type: 'markdown', content: '# Text' }) })
  const textArtifact = (await text.json()).artifact
  assert.equal((await fetch(`${base}/api/artifacts/${textArtifact.id}/preview`, { headers: { cookie: cookieA } })).status, 400)
})

test('previews HTML artifacts in a sandboxed frame for the owner only', async () => {
  const document = '<!DOCTYPE html><html><head><style>body{background:#2563eb}</style></head><body><h1>Preview me</h1></body></html>'
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'HTML doc', type: 'html', content: document }) })
  const artifact = (await created.json()).artifact

  const preview = await fetch(`${base}/api/artifacts/${artifact.id}/preview`, { headers: { cookie: cookieA } })
  assert.equal(preview.status, 200)
  assert.match(preview.headers.get('content-type'), /text\/html/)
  const csp = preview.headers.get('content-security-policy')
  assert.match(csp, /sandbox allow-scripts/)
  assert.match(csp, /connect-src 'none'/)
  assert.match(csp, /form-action 'none'/)
  assert.match(csp, /style-src 'self' 'unsafe-inline'/)
  assert.doesNotMatch(csp, /allow-same-origin/)
  assert.match(await preview.text(), /Preview me/)

  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/preview`)).status, 401)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/preview`, { headers: { cookie: cookieB } })).status, 404)
})

test('reads and restores historical versions without rewriting history', async () => {
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Versioned', type: 'markdown', content: '# One' }) })
  const artifact = (await created.json()).artifact
  await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(artifact.id), content: '# Two' }) })

  const first = await fetch(`${base}/api/artifacts/${artifact.id}/versions/1`, { headers: { cookie: cookieA } })
  assert.equal(first.status, 200)
  assert.equal((await first.json()).content, '# One')

  const second = await fetch(`${base}/api/artifacts/${artifact.id}/versions/2`, { headers: { cookie: cookieA } })
  assert.equal((await second.json()).content, '# Two')

  const before = (await (await fetch(`${base}/api/artifacts/${artifact.id}/versions`, { headers: { cookie: cookieA } })).json()).versions
  assert.deepEqual(before.map(version => version.version), [2, 1])

  const restored = await fetch(`${base}/api/artifacts/${artifact.id}/versions/1/restore`, { method: 'POST', headers: { cookie: cookieA } })
  assert.equal(restored.status, 200)
  const restoreBody = await restored.json()
  assert.equal(restoreBody.version, 3)
  assert.equal(restoreBody.restoredFrom, 1)

  const current = await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie: cookieA } })
  assert.equal((await current.json()).content, '# One')

  const after = (await (await fetch(`${base}/api/artifacts/${artifact.id}/versions`, { headers: { cookie: cookieA } })).json()).versions
  assert.deepEqual(after.map(version => version.version), [3, 2, 1])

  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/versions/99`, { headers: { cookie: cookieA } })).status, 404)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/versions/0`, { headers: { cookie: cookieA } })).status, 400)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/versions/abc`, { headers: { cookie: cookieA } })).status, 400)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/versions/99/restore`, { method: 'POST', headers: { cookie: cookieA } })).status, 404)

  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/versions/1`, { headers: { cookie: cookieB } })).status, 404)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/versions/1/restore`, { method: 'POST', headers: { cookie: cookieB } })).status, 404)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/versions/1`)).status, 401)

  const token = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'read only', scopes: ['read'] }) })
  const { token: readOnly } = await token.json()
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/versions/1/restore`, { method: 'POST', headers: { authorization: `Bearer ${readOnly}` } })).status, 403)
})

test('requires baseVersion for content writes and refuses stale ones', async () => {
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Guard', type: 'markdown', content: '# One' }) })
  const artifact = (await created.json()).artifact

  // Missing baseVersion is rejected outright.
  const missing = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ content: '# No base' }) })
  assert.equal(missing.status, 400)
  assert.match((await missing.json()).message, /baseVersion is required/)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie: cookieA } })).ok, true)

  // Correct baseVersion publishes.
  const ok = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: 1, content: '# Two' }) })
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).version, 2)

  // A writer still on version 1 is refused with 409 and nothing is written.
  const stale = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: 1, content: '# Stale' }) })
  assert.equal(stale.status, 409)
  const staleBody = await stale.json()
  assert.match(staleBody.message, /Stale write refused/)
  assert.equal(staleBody.data.currentVersion, 2)
  const afterStale = await (await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie: cookieA } })).json()
  assert.equal(afterStale.content, '# Two')

  // Metadata-only edits stay exempt so the UI can rename without a version.
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Renamed' }) })).status, 200)

  // Restoring a specific version stays exempt: it names its target explicitly.
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/versions/1/restore`, { method: 'POST', headers: { cookie: cookieA } })).status, 200)
  const restored = await (await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie: cookieA } })).json()
  assert.equal(restored.content, '# One')
})

test('does not record a version when content is unchanged', async () => {
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'No-op writes', type: 'markdown', content: '# Stable' }) })
  const artifact = (await created.json()).artifact

  const versions = async () => (await (await fetch(`${base}/api/artifacts/${artifact.id}/versions`, { headers: { cookie: cookieA } })).json()).versions

  // Rewriting the identical content must not append history.
  const noop = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(artifact.id), content: '# Stable' }) })
  assert.equal(noop.status, 200)
  const noopBody = await noop.json()
  assert.equal(noopBody.versionCreated, false)
  assert.deepEqual((await versions()).map(v => v.version), [1])

  // Title-only changes also create no version.
  await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Renamed only' }) })
  assert.deepEqual((await versions()).map(v => v.version), [1])

  // A real change still appends exactly one version.
  const changed = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(artifact.id), content: '# Changed' }) })
  assert.equal((await changed.json()).versionCreated, true)
  assert.deepEqual((await versions()).map(v => v.version), [2, 1])

  // Restoring the previous bytes is a real change, so it appends too.
  await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(artifact.id), content: '# Stable' }) })
  assert.deepEqual((await versions()).map(v => v.version), [3, 2, 1])
})

test('duplicates artifacts as private copies with the current content', async () => {
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Original', type: 'markdown', content: '# Original', visibility: 'public' }) })
  const artifact = (await created.json()).artifact
  await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: await latestVersionOf(artifact.id), content: '# Revised' }) })

  const duplicate = await fetch(`${base}/api/artifacts/${artifact.id}/duplicate`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Copy of original' }) })
  assert.equal(duplicate.status, 200)
  const copy = (await duplicate.json()).artifact
  assert.notEqual(copy.id, artifact.id)
  assert.equal(copy.title, 'Copy of original')
  assert.equal(copy.visibility, 'private')

  const read = await fetch(`${base}/api/artifacts/${copy.id}`, { headers: { cookie: cookieA } })
  const body = await read.json()
  assert.equal(body.content, '# Revised')
  assert.equal(body.artifact.folderId, null)

  const versions = await fetch(`${base}/api/artifacts/${copy.id}/versions`, { headers: { cookie: cookieA } })
  assert.deepEqual((await versions.json()).versions.map(version => version.version), [1])

  const defaultTitle = await fetch(`${base}/api/artifacts/${artifact.id}/duplicate`, { method: 'POST', headers: { cookie: cookieA } })
  assert.equal((await defaultTitle.json()).artifact.title, 'Original (copy)')

  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/duplicate`, { method: 'POST', headers: { cookie: cookieB } })).status, 404)
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/duplicate`, { method: 'POST' })).status, 401)

  const token = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'reader', scopes: ['read'] }) })
  const { token: readOnly } = await token.json()
  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}/duplicate`, { method: 'POST', headers: { authorization: `Bearer ${readOnly}` } })).status, 403)
})

test('overview summarizes counts, visibility, storage, and recent artifacts', async () => {
  const send = (cookie, method, path, body) => fetch(`${base}${path}`, { method, headers: { cookie, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const folder = (await (await send(cookieA, 'POST', '/api/folders', { name: 'Overview folder' })).json()).folder
  await send(cookieA, 'POST', '/api/artifacts', { title: 'Overview public', type: 'markdown', content: '# A', visibility: 'public', folderId: folder.id })
  await send(cookieA, 'POST', '/api/artifacts', { title: 'Overview unlisted', type: 'markdown', content: '# B', visibility: 'unlisted' })

  const form = new FormData()
  form.append('file', new Blob([Buffer.from('x'.repeat(2048))], { type: 'application/pdf' }), 'overview.pdf')
  form.append('title', 'Overview pdf')
  assert.equal((await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie: cookieA }, body: form })).status, 200)

  const overview = await send(cookieA, 'GET', '/api/overview')
  const body = await overview.json()
  assert.ok(body.summary.artifacts >= 3)
  assert.ok(body.summary.folders >= 1)
  assert.ok(body.summary.publicArtifacts >= 1)
  assert.ok(body.summary.unlistedArtifacts >= 1)
  assert.ok(body.summary.privateArtifacts >= 1)
  assert.ok(body.summary.totalBytes >= 2048)
  assert.ok(body.summary.byType.markdown >= 2)
  assert.ok(body.summary.byType.pdf >= 1)
  assert.ok(body.recent.length > 0)
  assert.ok(body.recent.every(artifact => !('contentPath' in artifact) && !('userId' in artifact)))
  assert.ok(body.recent.some(artifact => artifact.title === 'Overview pdf'))

  assert.equal((await fetch(`${base}/api/overview`)).status, 401)
  const other = await (await fetch(`${base}/api/overview`, { headers: { cookie: cookieB } })).json()
  assert.equal(other.summary.publicArtifacts, 0)
  assert.equal(other.recent.length, 0)
})

test('deletes extracted bundle files from the storage volume', async () => {
  const form = new FormData()
  form.append('file', new Blob([await zip([['index.html', '<h1>Temp bundle</h1>']])], { type: 'application/zip' }), 'temp.zip')
  form.append('title', 'Temp bundle')
  const upload = await fetch(`${base}/api/artifacts/upload`, { method: 'POST', headers: { cookie: cookieA }, body: form })
  assert.equal(upload.status, 200)
  const artifact = (await upload.json()).artifact
  const bundleDirectory = join(dataDir, 'files', userIdA, artifact.id, 'bundle')
  assert.ok((await filesUnder(bundleDirectory)).length > 0)

  assert.equal((await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'DELETE', headers: { cookie: cookieA } })).status, 200)
  assert.deepEqual(await filesUnder(bundleDirectory), [])
})

test('share identifiers are globally unique and cannot collide across users', async () => {
  // Two accounts ask for the same explicit slug. Share URLs resolve by slug
  // alone, so the second create must get a distinct identifier instead of
  // shadowing the first account's artifact.
  const create = (cookie, slug, content) => fetch(`${base}/api/artifacts`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Shared Slug', type: 'markdown', content, visibility: 'public', slug }),
  })
  const artifactA = (await (await create(cookieA, 'shared-slug', '# From A')).json()).artifact
  const artifactB = (await (await create(cookieB, 'shared-slug', '# From B')).json()).artifact
  assert.notEqual(artifactA.slug, artifactB.slug, 'the two artifacts must not share a public identifier')

  const json = await (await fetch(`${base}/api/share/shared-slug?format=json`)).json()
  assert.equal(json.title, 'Shared Slug', 'the original slug still resolves')

  // Titles that naturally collide also get a distinct suffix.
  const duplicate = (cookie) => fetch(`${base}/api/artifacts`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Same title', type: 'markdown', content: '# Same', visibility: 'public' }),
  })
  const first = (await (await duplicate(cookieA)).json()).artifact
  const second = (await (await duplicate(cookieB)).json()).artifact
  assert.notEqual(first.slug, second.slug)
})
