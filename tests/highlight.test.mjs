import assert from 'node:assert/strict'
import { test } from 'node:test'
import { highlightCode, stripShikiPre } from '../server/utils/highlight.ts'

test('common languages highlight with Shiki core markup', async () => {
  const json = await highlightCode('{"mcpServers":{"serangkai":{"type":"http"}}}', 'json')
  assert.ok(json, 'json should highlight')
  assert.match(json, /<pre class="shiki/)
  assert.match(json, /--shiki-light:#[0-9A-F]{3,8}/)
  assert.match(stripShikiPre(json), /^<code/)
  assert.doesNotMatch(stripShikiPre(json), /^<pre/)

  for (const [language, code] of [
    ['bash', 'curl -s https://example.com'],
    ['css', 'a { color: light-dark(#111, #f5f5f5); }'],
    ['javascript', 'const x = 1'],
    ['sh', 'echo hi'],
  ]) {
    const html = await highlightCode(code, language)
    assert.ok(html, `${language} should highlight`)
    assert.match(html, /--shiki-light:#[0-9A-F]{3,8}/, `${language} should carry token colors`)
  }
})

test('unknown or empty languages fall back to plain text', async () => {
  assert.equal(await highlightCode('{"a":1}', 'not-a-language'), null)
  assert.equal(await highlightCode('anything', ''), null)
})

test('highlighting escapes markup in the source', async () => {
  const html = await highlightCode('const bad = "<script>alert(1)</script>"', 'javascript')
  assert.ok(html)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&#x3C;script>/)
})