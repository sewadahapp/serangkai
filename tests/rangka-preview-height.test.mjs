import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_PREVIEW_HEIGHT, withBundleCanvas, withPreviewHeight } from '../server/utils/rangka-preview-height.ts'
import { parseCanvasSize } from '../shared/rangka-canvas.ts'

const plain = '<!doctype html><html><head><title>Plain</title></head><body><p>Hello</p></body></html>'

test('injects the height bridge into the head', () => {
  const out = withPreviewHeight(plain)
  assert.match(out, /data-serangkai-preview-height/)
  assert.match(out, /<head><script data-serangkai-preview-height>/)
  // The bridge must stay inside the document, not after it.
  assert.ok(out.indexOf('data-serangkai-preview-height') < out.indexOf('<body>'))
})

test('is idempotent', () => {
  const once = withPreviewHeight(plain)
  assert.equal(withPreviewHeight(once), once)
})

test('creates a head when only an html or body tag exists', () => {
  const htmlOnly = withPreviewHeight('<html><body><p>Hi</p></body></html>')
  assert.match(htmlOnly, /<html><head><script data-serangkai-preview-height>/)
  const bodyOnly = withPreviewHeight('<body><p>Hi</p></body>')
  assert.match(bodyOnly, /<body><script data-serangkai-preview-height>/)
})

test('prepends when there is no html, head, or body tag', () => {
  const out = withPreviewHeight('<p>Fragment</p>')
  assert.match(out, /^<script data-serangkai-preview-height>/)
})

test('does not report from a standalone visit', () => {
  const out = withPreviewHeight(plain)
  // Without this guard a direct visit would post to itself forever.
  assert.match(out, /window\.parent === window/)
})

test('lets viewport-sized apps opt out of height reporting', () => {
  const out = withPreviewHeight(plain)
  assert.match(out, /serangkai-presentation/)
  assert.match(out, /usesBoundedFrame/)
  assert.match(out, /value === 'app'/)
})

test('caps the reported height', () => {
  assert.ok(MAX_PREVIEW_HEIGHT > 0)
  assert.match(withPreviewHeight(plain), new RegExp(`Math\\.min\\(height, ${MAX_PREVIEW_HEIGHT}\\)`))
})

test('only adds the bridge to bundle HTML that opts into canvas mode', () => {
  const unmarked = Buffer.from(plain)
  assert.equal(withBundleCanvas(unmarked), unmarked)
  const canvas = Buffer.from(plain.replace('<head>', '<head><meta name="serangkai-canvas" content="1920x1080">'))
  assert.match(withBundleCanvas(canvas), /data-serangkai-preview-height/)
})

test('accepts a bounded pair of canvas dimensions', () => {
  assert.deepEqual(parseCanvasSize('1920x1080'), { width: 1920, height: 1080 })
  for (const invalid of ['1920x0', '4097x1080', '1920xInfinity', 'width=1920', null, { width: 1920, height: 1080 }]) {
    assert.equal(parseCanvasSize(invalid), null)
  }
})
