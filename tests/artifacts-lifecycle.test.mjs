import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { ZipFile } from 'yazl'

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

const register = async (prefix) => {
  const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${prefix}-${randomBytes(3).toString('hex')}@example.com`, password: 'correct horse battery' }) })
  assert.equal(response.status, 200)
  return { cookie: response.headers.get('set-cookie'), user: (await response.json()).user }
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-lifecycle-test-'))
  child = spawn('node', ['.output/server/index.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'), DATABASE_PATH: join(dataDir, 'serangkai.db'), STORAGE_PATH: join(dataDir, 'files') }, stdio: 'ignore' })
  let healthy = false
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  if (!healthy) throw new Error('Server did not become healthy before the lifecycle test')
  const a = await register('lifecycle-a')
  cookieA = a.cookie
  userIdA = a.user.id
  cookieB = (await register('lifecycle-b')).cookie
})

after(async () => { child?.kill('SIGTERM'); await rm(dataDir, { recursive: true, force: true }) })

test('deletes an artifact, its versions, and its stored files', async () => {
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Disposable', type: 'markdown', content: '# One' }) })
  const artifact = (await created.json()).artifact
  const updated = await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ content: '# Two' }) })
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

test('reads and restores historical versions without rewriting history', async () => {
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Versioned', type: 'markdown', content: '# One' }) })
  const artifact = (await created.json()).artifact
  await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ content: '# Two' }) })

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

test('duplicates artifacts as private copies with the current content', async () => {
  const created = await fetch(`${base}/api/artifacts`, { method: 'POST', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Original', type: 'markdown', content: '# Original', visibility: 'public' }) })
  const artifact = (await created.json()).artifact
  await fetch(`${base}/api/artifacts/${artifact.id}`, { method: 'PUT', headers: { cookie: cookieA, 'content-type': 'application/json' }, body: JSON.stringify({ content: '# Revised' }) })

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
