import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MAX_PREVIEW_HEIGHT, withPreviewHeight } from '../server/utils/rangka-preview-height.ts'

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

test('caps the reported height', () => {
  assert.ok(MAX_PREVIEW_HEIGHT > 0)
  assert.match(withPreviewHeight(plain), new RegExp(`Math\\.min\\(height, ${MAX_PREVIEW_HEIGHT}\\)`))
})
