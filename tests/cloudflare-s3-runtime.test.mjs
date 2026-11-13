import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { adminEnv, adminPassword, adminUsername, login } from './helpers/auth.mjs'
import { startS3Mock } from './helpers/s3-mock.mjs'

/**
 * The Backblaze B2 deployment path on the Workers runtime: the built Worker
 * runs with wrangler.b2.jsonc (D1 only, no R2 binding) and STORAGE_DRIVER=s3
 * against a local S3-compatible mock. This proves the adapter works inside
 * workerd without Node APIs and that no R2 binding is required.
 */

const port = 4120 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child
let mock
let output = ''

function signalGroup(signal) {
  if (!child?.pid) return
  try {
    process.kill(-child.pid, signal)
  } catch {
    try { child.kill(signal) } catch {}
  }
}

async function stopWorker() {
  if (!child || child.exitCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  signalGroup('SIGTERM')
  const timer = setTimeout(() => signalGroup('SIGKILL'), 5000)
  await exited
  clearTimeout(timer)
  child.stdout?.destroy()
  child.stderr?.destroy()
  child = undefined
}

async function startWorker(workerPort = port, s3 = null) {
  const storage = s3 || {
    endpoint: mock.endpoint,
    region: mock.region,
    bucket: mock.bucket,
    keyId: mock.keyId,
    secret: mock.secret,
  }
  const jwtSecret = randomBytes(32).toString('hex')
  const shareSecret = randomBytes(32).toString('hex')
  child = spawn('bunx', [
    'wrangler', 'dev', '--config', 'wrangler.b2.jsonc', '--local',
    '--port', String(workerPort), '--show-interactive-dev-session=false',
    '--var', `JWT_SECRET:${jwtSecret}`,
    '--var', `SHARE_SECRET:${shareSecret}`,
    '--var', `ADMIN_USERNAME:${adminUsername}`,
    '--var', `ADMIN_PASSWORD:${adminPassword}`,
    '--var', `NUXT_APP_SECRET:${process.env.NUXT_APP_SECRET}`,
    '--var', 'NUXT_SESSION_COOKIE_SECURE:false',
    '--var', 'STORAGE_DRIVER:s3',
    '--var', `S3_ENDPOINT:${storage.endpoint}`,
    '--var', `S3_REGION:${storage.region}`,
    '--var', `S3_BUCKET:${storage.bucket}`,
    '--var', `S3_ACCESS_KEY_ID:${storage.keyId}`,
    '--var', `S3_SECRET_ACCESS_KEY:${storage.secret}`,
  ], { cwd: process.cwd(), env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  child.stdout.on('data', chunk => { output += chunk.toString() })
  child.stderr.on('data', chunk => { output += chunk.toString() })
  const workerBase = `http://127.0.0.1:${workerPort}`
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${workerBase}/api/health`)).ok) return } catch {}
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Wrangler local Worker did not start\n${output}`)
}

before(async () => {
  mock = await startS3Mock()
  await startWorker()
})

after(async () => {
  await stopWorker()
  await mock?.close()
  await rm('.wrangler', { recursive: true, force: true })
})

test('B2-style storage works on Workers with D1 and no R2 binding', { timeout: 90000 }, async () => {
  const { cookie } = await login(base)

  // A markdown rangka stores its content through the S3 driver.
  const created = await fetch(`${base}/api/rangka`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'B2 runtime rangka', type: 'markdown', content: '# Stored in B2' }),
  })
  const createdBody = await created.text()
  assert.equal(created.status, 200, createdBody)
  const rangka = JSON.parse(createdBody).rangka

  // Binary uploads must survive the S3 round-trip without corruption.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png')
  form.append('title', 'B2 image')
  const uploaded = await fetch(`${base}/api/rangka/upload`, { method: 'POST', headers: { cookie }, body: form })
  const uploadBody = await uploaded.text()
  assert.equal(uploaded.status, 200, uploadBody)
  const image = JSON.parse(uploadBody).rangka

  const downloaded = await fetch(`${base}/api/rangka/${image.id}/download`, { headers: { cookie } })
  assert.equal(downloaded.status, 200)
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png)

  // The bytes in the bucket match the upload, and the object path keeps the
  // userId/rangkaId hierarchy.
  // The bytes in the bucket match the upload, and the object path keeps the
  // userId/rangkaId hierarchy.
  const stored = [...mock.objects.entries()].find(([key]) => key.includes(image.id))
  assert.ok(stored, `expected an object for ${image.id} in ${[...mock.objects.keys()].join(', ')}`)
  assert.deepEqual(stored[1], png)

  // D1 still holds metadata; no R2 binding is configured anywhere.
  const listed = await (await fetch(`${base}/api/rangka`, { headers: { cookie } })).json()
  const titles = listed.rangka.map(entry => entry.title).sort()
  assert.deepEqual(titles, ['B2 image', 'B2 runtime rangka'])
  assert.ok(rangka.id)

  // Updating goes through the same adapter, and deletion removes the object.
  const updated = await fetch(`${base}/api/rangka/${rangka.id}`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ content: '# Updated in B2', baseVersion: 1 }),
  })
  assert.equal(updated.status, 200, await updated.text())
  const fetched = await (await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie } })).json()
  assert.equal(fetched.content, '# Updated in B2')

  const deleted = await fetch(`${base}/api/rangka/${image.id}`, { method: 'DELETE', headers: { cookie } })
  assert.equal(deleted.status, 200, await deleted.text())
  assert.ok(![...mock.objects.keys()].some(key => key.includes(image.id)), 'the deleted rangka object must be removed from the bucket')

  // A local redeploy (Worker restart on the same bucket and D1 state) must
  // keep serving the stored rangka.
  await stopWorker()
  await startWorker()
  const relogin = await login(base)
  const afterRestart = await fetch(`${base}/api/rangka/${rangka.id}`, { headers: { cookie: relogin.cookie } })
  assert.equal(afterRestart.status, 200)
  assert.equal((await afterRestart.json()).content, '# Updated in B2')

  // Every request that reached the mock was signed; nothing bypassed the driver.
  assert.ok(mock.requests.length > 0)
  for (const request of mock.requests) {
    assert.equal(request.signed, true, `${request.method} ${request.path} must be signed`)
  }
  // No ephemeral fallback and no R2 involvement.
  assert.doesNotMatch(output, /ephemeral memory storage/)
  assert.doesNotMatch(output, /R2 binding/)
})

test('a misconfigured S3 endpoint fails storage loudly instead of using Worker memory', { timeout: 90000 }, async () => {
  // Backblaze displays its endpoint as a bare hostname; deploying it without
  // the scheme used to surface as a cryptic "Invalid URL string." on upload.
  // The misconfiguration must be reported, and uploads must NOT fall through
  // to unstorage's in-memory default (which would lose the file silently).
  await stopWorker()
  const badPort = port + 1
  const badBase = `http://127.0.0.1:${badPort}`
  await startWorker(badPort, {
    endpoint: 's3.us-west-004.backblazeb2.com',
    region: mock.region,
    bucket: mock.bucket,
    keyId: mock.keyId,
    secret: mock.secret,
  })

  const { cookie } = await login(badBase)
  const before = mock.requests.length
  for (let attempt = 0; attempt < 2; attempt++) {
    const created = await fetch(`${badBase}/api/rangka`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: `Broken storage ${attempt}`, type: 'markdown', content: '# nope' }),
    })
    // A loud failure, both times: the second attempt must not "succeed"
    // because the first one quietly wrote into memory.
    assert.equal(created.status, 500, await created.text())
  }
  assert.equal(mock.requests.length, before, 'no request may reach the S3 endpoint with an invalid config')
  assert.match(output, /S3 storage is misconfigured: S3_ENDPOINT must be an absolute URL including the scheme/)
  assert.doesNotMatch(output, /ephemeral memory storage/)
})