import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test, before, after } from 'node:test'
import { createStorage } from 'unstorage'
import { s3Driver } from '../server/utils/s3-driver.ts'
import { startS3Mock } from './helpers/s3-mock.mjs'

/**
 * S3-compatible storage adapter coverage against a local mock that speaks the
 * same wire protocol as Backblaze B2 (see tests/helpers/s3-mock.mjs). The mock
 * verifies every SigV4 signature and payload hash, so a signing regression
 * fails here rather than against a hosted bucket.
 */

let mock

before(async () => { mock = await startS3Mock() })
after(async () => { await mock.close() })

function makeDriver(overrides = {}) {
  return s3Driver({
    accessKeyId: mock.keyId,
    secretAccessKey: mock.secret,
    endpoint: mock.endpoint,
    region: mock.region,
    bucket: mock.bucket,
    ...overrides,
  })
}

test('the probe accepts a valid bucket and rejects bad credentials or a missing bucket', async () => {
  await makeDriver().getInstance()
  await assert.rejects(() => makeDriver({ secretAccessKey: 'wrong' }).getInstance(), /403/)
  await assert.rejects(() => makeDriver({ bucket: 'no-such-bucket' }).getInstance(), /404/)
})

test('misconfigured options fail with an actionable message before any request', () => {
  // Backblaze displays the endpoint as a bare hostname; the full URL is required.
  assert.throws(() => makeDriver({ endpoint: 's3.us-west-004.backblazeb2.com' }), /S3_ENDPOINT must be an absolute URL including the scheme/)
  assert.throws(() => makeDriver({ endpoint: 'ftp://s3.example.com' }), /S3_ENDPOINT must use http or https/)
  assert.throws(() => makeDriver({ bucket: 'not a bucket' }), /S3_BUCKET must be a valid bucket name/)
  assert.throws(() => makeDriver({ secretAccessKey: '' }), /S3_SECRET_ACCESS_KEY is required/)
  assert.throws(() => makeDriver({ accessKeyId: '' }), /S3_ACCESS_KEY_ID is required/)
})

test('binary objects round-trip byte-for-byte through create, read, update, delete', async () => {
  const driver = makeDriver()
  const key = 'user-1/artifact-1/content.bin'
  const first = randomBytes(4096)
  await driver.setItemRaw(key, first)
  assert.deepEqual(Buffer.from(await driver.getItemRaw(key)), first)
  assert.equal(await driver.hasItem(key), true)

  const updated = randomBytes(8192)
  await driver.setItemRaw(key, updated)
  assert.deepEqual(Buffer.from(await driver.getItemRaw(key)), updated)

  await driver.removeItem(key)
  assert.equal(await driver.getItemRaw(key), null)
  assert.equal(await driver.hasItem(key), false)
  // Deleting a missing object is a no-op, matching the filesystem driver.
  await driver.removeItem(key)
})

test('text items and keys with spaces, unicode, and nested paths survive', async () => {
  const driver = makeDriver()
  const key = 'user-1/bundle-1/assets/héllo world & co.txt'
  await driver.setItem(key, '# Héllo\n')
  assert.equal(await driver.getItem(key), '# Héllo\n')
  const keys = await driver.getKeys('user-1/bundle-1/')
  assert.ok(keys.includes(key))
  await driver.removeItem(key)
})

test('dot segments are refused instead of resolving to another object', async () => {
  const driver = makeDriver()
  await driver.setItemRaw('owner/private-1/content', Buffer.from('secret'))
  // unstorage hands drivers colon-separated keys; `..` must never be resolved
  // by the URL parser into a sibling object.
  for (const key of ['owner:bundle-1:bundle:..:..:private-1:content', 'owner/bundle-1/bundle/../../private-1/content', 'owner:.:content']) {
    await assert.rejects(() => driver.getItemRaw(key), /Invalid key/)
    await assert.rejects(() => driver.setItemRaw(key, Buffer.from('x')), /Invalid key/)
  }
  assert.equal(Buffer.from(await driver.getItemRaw('owner/private-1/content')).toString(), 'secret')
  await driver.removeItem('owner/private-1/content')
})

test('listing is prefix-scoped and paginated', async () => {
  const driver = makeDriver()
  const keys = ['list/a/one', 'list/a/two', 'list/a/three', 'list/a/four', 'list/b/other']
  for (const key of keys) await driver.setItemRaw(key, new Uint8Array([1]))
  // The mock pages at two keys, so this exercises continuation tokens.
  const listed = await driver.getKeys('list/a/')
  assert.deepEqual(listed.sort(), ['list/a/four', 'list/a/one', 'list/a/three', 'list/a/two'])
  for (const key of keys) await driver.removeItem(key)
})

test('a failed write is loud, never a silent success', async () => {
  const driver = makeDriver({ bucket: 'no-such-bucket' })
  // The upstream unstorage driver maps 404 to null even for PUT; this must throw.
  await assert.rejects(() => driver.setItemRaw('user-1/artifact-x/content', new Uint8Array([1])), /404/)
})

test('the driver works through the unstorage mount surface', async () => {
  const storage = createStorage()
  storage.mount('artifacts', makeDriver())
  const key = 'user-9/artifact-9/v1'
  await storage.setItemRaw(`artifacts:${key}`, new Uint8Array([0, 255, 1, 254]))
  assert.deepEqual(Buffer.from(await storage.getItemRaw(`artifacts:${key}`)), Buffer.from([0, 255, 1, 254]))
  const keys = await storage.getKeys('artifacts:user-9/')
  // unstorage normalizes returned keys to its colon-separated key space.
  assert.deepEqual(keys, ['artifacts:user-9:artifact-9:v1'])
  // The object itself keeps the path hierarchy in the bucket.
  assert.ok(mock.objects.has(key))
  await storage.removeItem(`artifacts:${key}`)
  assert.equal(await storage.getItemRaw(`artifacts:${key}`), null)
})

test('every request the driver sends carries a valid signature', async () => {
  // A fresh mock so the deliberate bad-credential probe above is not counted.
  const signed = await startS3Mock()
  try {
    const driver = s3Driver({
      accessKeyId: signed.keyId,
      secretAccessKey: signed.secret,
      endpoint: signed.endpoint,
      region: signed.region,
      bucket: signed.bucket,
    })
    await driver.getInstance()
    await driver.setItemRaw('sign/a', new Uint8Array([1, 2, 3]))
    await driver.getItemRaw('sign/a')
    await driver.hasItem('sign/a')
    await driver.getKeys('sign/')
    await driver.removeItem('sign/a')

    assert.ok(signed.requests.length >= 6)
    for (const request of signed.requests) {
      assert.equal(request.signed, true, `${request.method} ${request.path} must be signed`)
    }
  } finally {
    await signed.close()
  }
})