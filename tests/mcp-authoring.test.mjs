import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'

const port = 4120 + Math.floor(Math.random() * 200)
const base = `http://127.0.0.1:${port}`
let child, dataDir, token, cookie

async function rpc(message) {
  const response = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify(message),
  })
  const body = await response.json()
  assert.equal(response.status, 200, JSON.stringify(body))
  assert.equal(body.jsonrpc, '2.0')
  return body
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-mcp-authoring-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: randomBytes(32).toString('hex'),
      SHARE_SECRET: randomBytes(32).toString('hex'),
      DATABASE_PATH: join(dataDir, 'serangkai.db'),
      STORAGE_PATH: join(dataDir, 'files'),
    },
    stdio: 'ignore',
  })
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const email = `mcp-authoring-${randomBytes(2).toString('hex')}@example.com`
  const registered = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct horse battery' }) })
  cookie = registered.headers.get('set-cookie')
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct horse battery' }) })
  cookie = login.headers.get('set-cookie') || cookie
  const tokenResponse = await fetch(`${base}/api/tokens`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'authoring-test', scopes: ['read', 'write'] }) })
  token = (await tokenResponse.json()).token
  assert.ok(token)
})

after(async () => {
  child?.kill('SIGTERM')
  if (dataDir) await rm(dataDir, { recursive: true, force: true })
})

test('MCP exposes capabilities, guides, components, templates, and prompts', async () => {
  const initialized = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'blind-authoring-test', version: '1.0.0' } } })
  assert.equal(initialized.result.serverInfo.name, 'serangkai')

  const tools = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  const toolNames = tools.result.tools.map(tool => tool.name)
  assert.ok(toolNames.includes('get_artifact_capabilities'), toolNames.join(','))
  const create = tools.result.tools.find(tool => tool.name === 'create_artifact')
  assert.match(create.description, /get_artifact_capabilities/)

  const capabilities = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_artifact_capabilities', arguments: {} } })
  const capabilityText = capabilities.result.content[0].text
  const parsed = JSON.parse(capabilityText)
  assert.ok(parsed.artifactTypes.some(item => item.type === 'markdown'))
  assert.ok(parsed.markdown.components.includes('s-table'))
  assert.ok(parsed.markdown.applicationOnlyComponents.includes('SModal'))
  assert.equal(parsed.html.defaultStyling.startsWith('self-styled'), true)

  const resources = await rpc({ jsonrpc: '2.0', id: 4, method: 'resources/list', params: {} })
  const resourceUris = resources.result.resources.map(resource => resource.uri)
  for (const uri of [
    'serangkai://capabilities',
    'serangkai://guides/markdown',
    'serangkai://guides/html',
    'serangkai://components/selaras',
    'serangkai://templates/report',
    'serangkai://templates/technicalDoc',
    'serangkai://templates/dashboard',
    'serangkai://templates/diagram',
    'serangkai://templates/interactiveApp',
  ]) assert.ok(resourceUris.includes(uri), `${uri} missing from ${resourceUris.join(',')}`)

  const markdownGuide = await rpc({ jsonrpc: '2.0', id: 5, method: 'resources/read', params: { uri: 'serangkai://guides/markdown' } })
  assert.match(markdownGuide.result.contents[0].text, /Comark/)
  assert.match(markdownGuide.result.contents[0].text, /s-table/)
  assert.match(markdownGuide.result.contents[0].text, /chart/)

  const catalog = await rpc({ jsonrpc: '2.0', id: 6, method: 'resources/read', params: { uri: 'serangkai://components/selaras' } })
  assert.match(catalog.result.contents[0].text, /s-alert/)
  assert.match(catalog.result.contents[0].text, /s-table/)
  assert.match(catalog.result.contents[0].text, /Application-only components/)
  assert.doesNotMatch(catalog.result.contents[0].text, /^### s-checkbox/m)

  const htmlGuide = await rpc({ jsonrpc: '2.0', id: 7, method: 'resources/read', params: { uri: 'serangkai://guides/html' } })
  assert.match(htmlGuide.result.contents[0].text, /serangkai-theme/)
  assert.match(htmlGuide.result.contents[0].text, /data-serangkai-chart/)

  const templates = await rpc({ jsonrpc: '2.0', id: 8, method: 'resources/read', params: { uri: 'serangkai://templates/report' } })
  assert.match(templates.result.contents[0].text, /s-callout/)
  assert.match(templates.result.contents[0].text, /chart/)

  const prompts = await rpc({ jsonrpc: '2.0', id: 9, method: 'prompts/list', params: {} })
  assert.ok(prompts.result.prompts.some(prompt => prompt.name === 'create_report'))
  const prompt = await rpc({ jsonrpc: '2.0', id: 10, method: 'prompts/get', params: { name: 'create_report' } })
  assert.match(prompt.result.messages[0].content.text, /Markdown report/)
})

test('an agent can author a rich report from MCP guidance alone', async () => {
  const guide = await rpc({ jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri: 'serangkai://guides/markdown' } })
  assert.match(guide.result.contents[0].text, /::s-table/)

  const content = [
    '# MCP-only report',
    '',
    '## Summary',
    '',
    'This artifact was authored from the MCP capabilities and Markdown guide only.',
    '',
    '| Metric | W1 | W2 |',
    '| --- | --- | --- |',
    '| Readers | 1,200 | 1,800 |',
    '',
    '::s-callout{type="tip" title="What changed"}',
    'The onboarding flow removed two steps.',
    '::',
    '',
    '```chart',
    '{"type":"bar","title":"Readers per week","data":[{"week":"W1","value":1200},{"week":"W2","value":1800}],"x":"week","y":"value"}',
    '```',
    '',
    '```mermaid',
    'flowchart LR',
    '  Draft --> Review --> Share',
    '```',
  ].join('\n')

  const created = await rpc({
    jsonrpc: '2.0',
    id: 11,
    method: 'tools/call',
    params: {
      name: 'create_artifact',
      arguments: { title: 'MCP-only report', type: 'markdown', content, visibility: 'public' },
    },
  })
  const artifact = JSON.parse(created.result.content[0].text)
  assert.ok(artifact.id)

  const read = await rpc({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'get_artifact', arguments: { id: artifact.id } } })
  const readArtifact = JSON.parse(read.result.content[0].text)
  assert.equal(readArtifact.currentVersion, 1)
  assert.match(readArtifact.content, /s-callout/)

  const owner = await fetch(`${base}/api/artifacts/${artifact.id}`, { headers: { cookie } })
  const ownerBody = await owner.json()
  assert.equal(ownerBody.artifact.title, 'MCP-only report')
  assert.ok(ownerBody.body)
  assert.ok(ownerBody.toc.some(link => link.id === 'summary'))
  assert.ok(JSON.stringify(ownerBody.body).includes('s-callout'))
  assert.ok(JSON.stringify(ownerBody.body).includes('serangkai-chart'))
  assert.ok(JSON.stringify(ownerBody.body).includes('serangkai-mermaid'))
})
