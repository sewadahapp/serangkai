import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withRangkaRuntime } from '../server/utils/rangka-runtime.ts'

const plain = '<!doctype html><html><head><title>Plain</title></head><body><p>Hello</p></body></html>'

test('leaves rangka without markers untouched', () => {
  assert.equal(withRangkaRuntime(plain), plain)
})

test('injects only Mermaid for a .mermaid block', () => {
  const html = '<!doctype html><html><head></head><body><pre class="mermaid">graph TD; A-->B;</pre></body></html>'
  const out = withRangkaRuntime(html)
  assert.match(out, /src="\/runtime\/mermaid\.js"/)
  assert.doesNotMatch(out, /src="\/runtime\/charts\.js"/)
  assert.match(out, /data-serangkai-runtime>/)
})

test('injects only charts for a chart marker', () => {
  const html = '<!doctype html><html><head></head><body><script type="application/json" data-serangkai-chart>{"type":"bar"}</script></body></html>'
  const out = withRangkaRuntime(html)
  assert.match(out, /src="\/runtime\/charts\.js"/)
  assert.doesNotMatch(out, /src="\/runtime\/mermaid\.js"/)
})

test('injects both runtimes when both markers are present', () => {
  const html = '<!doctype html><html><head></head><body><div class="mermaid">graph TD; A-->B;</div><div data-serangkai-chart="{}"></div></body></html>'
  const out = withRangkaRuntime(html)
  assert.match(out, /src="\/runtime\/charts\.js"/)
  assert.match(out, /src="\/runtime\/mermaid\.js"/)
})

test('is idempotent when the runtime is already present', () => {
  const html = '<!doctype html><html><head><script data-serangkai-runtime src="/runtime/charts.js"></script></head><body><div data-serangkai-chart="{}"></div></body></html>'
  assert.equal(withRangkaRuntime(html), html)
})

test('falls back to prepending when there is no head, html, or body tag', () => {
  const out = withRangkaRuntime('<div class="mermaid">graph TD; A-->B;</div>')
  assert.match(out, /^<style data-serangkai-runtime>/)
  assert.match(out, /src="\/runtime\/mermaid\.js"/)
})
