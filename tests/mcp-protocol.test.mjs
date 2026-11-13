import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

const port = 3220 + Math.floor(Math.random() * 200)
const baseUrl = `http://127.0.0.1:${port}`
let processHandle
let dataDir
let token
let readOnlyToken

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Server did not start')
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  })
  const body = await response.json()
  assert.equal(response.ok, true, JSON.stringify(body))
  return body
}

async function mcp(message) {
  const response = await fetch(`${baseUrl}/api/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(message),
  })
  const body = await response.json()
  assert.equal(response.ok, true, JSON.stringify(body))
  assert.equal(body.jsonrpc, '2.0')
  return body
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-mcp-test-'))
  processHandle = spawn(serverRuntime, ['.output/server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      ...adminEnv(),
      PORT: String(port),
      JWT_SECRET: randomBytes(32).toString('hex'), SHARE_SECRET: randomBytes(32).toString('hex'),
      DATABASE_PATH: join(dataDir, 'serangkai.db'),
      STORAGE_PATH: join(dataDir, 'files'),
    },
    stdio: 'ignore',
  })
  await waitForServer()
  const { cookie } = await login(baseUrl)
  const tokenResponse = await jsonRequest('/api/tokens', { method: 'POST', headers: { cookie }, body: JSON.stringify({ name: 'test', scopes: ['read', 'write'] }) })
  token = tokenResponse.token
  assert.ok(token)
  const readOnlyResponse = await jsonRequest('/api/tokens', { method: 'POST', headers: { cookie }, body: JSON.stringify({ name: 'read-only', scopes: ['read'] }) })
  readOnlyToken = readOnlyResponse.token
})

after(async () => {
  processHandle?.kill('SIGTERM')
  await rm(dataDir, { recursive: true, force: true })
})

test('supports MCP initialization and tool discovery', async () => {
  const initialized = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } } })
  assert.equal(initialized.result.serverInfo.name, 'serangkai')
  assert.match(initialized.result.instructions, /create_rangka.*Serangkai/)
  assert.equal(initialized.result.protocolVersion, '2025-06-18')

  const tools = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  const names = tools.result.tools.map(tool => tool.name)
  assert.deepEqual(names, ['get_rangka_capabilities', 'list_folders', 'search', 'create_folder', 'list_rangka', 'get_rangka', 'create_rangka', 'update_rangka'])
})

test('creates and reads a rangka through MCP tools', async () => {
  const created = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'create_rangka', arguments: { title: 'Protocol Test', type: 'markdown', content: '# MCP', visibility: 'private' } } })
  const rangka = JSON.parse(created.result.content[0].text)
  assert.equal(rangka.title, 'Protocol Test')

  const read = await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_rangka', arguments: { id: rangka.id } } })
  const result = JSON.parse(read.result.content[0].text)
  assert.equal(result.content, '# MCP')
  // Publishing requires baseVersion, so the read must report the current one.
  assert.equal(result.currentVersion, 1)

  const published = await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'update_rangka', arguments: { id: rangka.id, content: '# MCP v2', baseVersion: result.currentVersion } } })
  const updated = JSON.parse(published.result.content[0].text)
  assert.equal(updated.versionCreated, true)
  assert.equal(updated.version, 2)

  const reread = await mcp({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'get_rangka', arguments: { id: rangka.id } } })
  assert.equal(JSON.parse(reread.result.content[0].text).currentVersion, 2)
})

test('creates folders and files rangka inside them through MCP tools', async () => {
  const folderResponse = await mcp({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'create_folder', arguments: { name: 'Reports' } } })
  const folder = JSON.parse(folderResponse.result.content[0].text)
  assert.equal(folder.path, '/Reports')

  const created = await mcp({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'create_rangka', arguments: { title: 'Folder rangka', type: 'markdown', content: '# Foldered', folderId: folder.id } } })
  const rangka = JSON.parse(created.result.content[0].text)
  assert.equal(rangka.folderId, folder.id)

  const listed = await mcp({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'list_folders', arguments: {} } })
  assert.equal(JSON.parse(listed.result.content[0].text)[0].name, 'Reports')

  const moved = await mcp({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'update_rangka', arguments: { id: rangka.id, folderId: null } } })
  assert.equal(JSON.parse(moved.result.content[0].text).folderId, null)
})

test('searches rangka and folders through MCP, scoped to a folder', async () => {
  const folderResponse = await mcp({ jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'create_folder', arguments: { name: 'Search scope' } } })
  const folder = JSON.parse(folderResponse.result.content[0].text)
  const inside = JSON.parse((await mcp({ jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'create_rangka', arguments: { title: 'Zebra inside', type: 'markdown', content: '# In', folderId: folder.id } } })).result.content[0].text)
  await mcp({ jsonrpc: '2.0', id: 13, method: 'tools/call', params: { name: 'create_rangka', arguments: { title: 'Zebra outside', type: 'markdown', content: '# Out' } } })

  const global = await mcp({ jsonrpc: '2.0', id: 14, method: 'tools/call', params: { name: 'search', arguments: { query: 'Zebra' } } })
  const globalResult = JSON.parse(global.result.content[0].text)
  assert.deepEqual(globalResult.rangka.map(rangka => rangka.title).sort(), ['Zebra inside', 'Zebra outside'])

  const scoped = await mcp({ jsonrpc: '2.0', id: 15, method: 'tools/call', params: { name: 'search', arguments: { query: 'Zebra', folderId: folder.id } } })
  assert.deepEqual(JSON.parse(scoped.result.content[0].text).rangka.map(rangka => rangka.id), [inside.id])

  const folderSearch = await mcp({ jsonrpc: '2.0', id: 16, method: 'tools/call', params: { name: 'search', arguments: { query: 'Search scope' } } })
  assert.equal(JSON.parse(folderSearch.result.content[0].text).folders[0].name, 'Search scope')

  const missing = await mcp({ jsonrpc: '2.0', id: 17, method: 'tools/call', params: { name: 'search', arguments: { query: 'Zebra', folderId: 'nope' } } })
  assert.equal(missing.result.isError, true)
})

test('refuses a stale publish and names the current version', async () => {
  const created = await mcp({ jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'create_rangka', arguments: { title: 'Stale guard', type: 'markdown', content: '# One' } } })
  const rangka = JSON.parse(created.result.content[0].text)

  // Read at version 1, then publish a real change at that base.
  const first = await mcp({ jsonrpc: '2.0', id: 21, method: 'tools/call', params: { name: 'update_rangka', arguments: { id: rangka.id, content: '# Two', baseVersion: 1 } } })
  const firstBody = JSON.parse(first.result.content[0].text)
  assert.equal(firstBody.versionCreated, true)
  assert.equal(firstBody.version, 2)

  // A second publisher still holding version 1 must be refused.
  const stale = await mcp({ jsonrpc: '2.0', id: 22, method: 'tools/call', params: { name: 'update_rangka', arguments: { id: rangka.id, content: '# Stale', baseVersion: 1 } } })
  assert.equal(stale.result.isError, true)
  assert.match(stale.result.content[0].text, /Stale write refused/)
  assert.match(stale.result.content[0].text, /current version is 2/)

  // The stale content must not have been applied.
  const read = await mcp({ jsonrpc: '2.0', id: 23, method: 'tools/call', params: { name: 'get_rangka', arguments: { id: rangka.id } } })
  assert.equal(JSON.parse(read.result.content[0].text).content, '# Two')

  // Retrying with the current base version succeeds.
  const retry = await mcp({ jsonrpc: '2.0', id: 24, method: 'tools/call', params: { name: 'update_rangka', arguments: { id: rangka.id, content: '# Three', baseVersion: 2 } } })
  assert.equal(JSON.parse(retry.result.content[0].text).version, 3)

  // A no-op publish at the current version reports no new version.
  const noop = await mcp({ jsonrpc: '2.0', id: 25, method: 'tools/call', params: { name: 'update_rangka', arguments: { id: rangka.id, content: '# Three', baseVersion: 3 } } })
  const noopBody = JSON.parse(noop.result.content[0].text)
  assert.equal(noopBody.versionCreated, false)
  assert.equal(noopBody.version, 3)

  // Omitting baseVersion on a content change is now rejected.
  const unchecked = await mcp({ jsonrpc: '2.0', id: 26, method: 'tools/call', params: { name: 'update_rangka', arguments: { id: rangka.id, content: '# Four' } } })
  assert.equal(unchecked.result.isError, true)
  assert.match(unchecked.result.content[0].text, /baseVersion is required/)

  // Metadata-only updates stay exempt.
  const meta = await mcp({ jsonrpc: '2.0', id: 27, method: 'tools/call', params: { name: 'update_rangka', arguments: { id: rangka.id, visibility: 'unlisted' } } })
  assert.equal(JSON.parse(meta.result.content[0].text).visibility, 'unlisted')
})

test('declares destructive hints on mutating tools only', async () => {
  const tools = await mcp({ jsonrpc: '2.0', id: 30, method: 'tools/list', params: {} })
  const byName = Object.fromEntries(tools.result.tools.map(tool => [tool.name, tool]))
  assert.equal(byName.update_rangka.annotations?.destructiveHint, true)
  assert.equal(byName.create_rangka.annotations?.destructiveHint, false)
  for (const readOnly of ['list_folders', 'search', 'list_rangka', 'get_rangka']) {
    assert.equal(byName[readOnly].annotations?.readOnlyHint, true, `${readOnly} should be readOnlyHint`)
  }
})

test('rejects MCP requests without authentication', async () => {
  const response = await fetch(`${baseUrl}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} }) })
  assert.equal(response.status, 401)
})

test('rejects write tools for read-only tokens', async () => {
  const response = await fetch(`${baseUrl}/api/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${readOnlyToken}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'create_rangka', arguments: { title: 'Denied', type: 'markdown', content: 'nope' } } }),
  })
  const body = await response.json()
  assert.equal(response.ok, true)
  assert.equal(body.result.isError, true)
  assert.match(body.result.content[0].text, /write scope/)
})

test('create_rangka only advertises text types and labels SVG images', async () => {
  const tools = await mcp({ jsonrpc: '2.0', id: 40, method: 'tools/list', params: {} })
  const create = tools.result.tools.find(tool => tool.name === 'create_rangka')
  assert.deepEqual([...create.inputSchema.properties.type.enum].sort(), ['html', 'image', 'javascript', 'json', 'markdown'])

  const bundle = await mcp({ jsonrpc: '2.0', id: 41, method: 'tools/call', params: { name: 'create_rangka', arguments: { title: 'Zip', type: 'bundle', content: 'x' } } })
  assert.ok(bundle.error || bundle.result?.isError, 'bundle text create refused')

  const raster = await mcp({ jsonrpc: '2.0', id: 42, method: 'tools/call', params: { name: 'create_rangka', arguments: { title: 'Png', type: 'image', content: 'iVBORw0KGgo=' } } })
  assert.equal(raster.result.isError, true)
  assert.match(raster.result.content[0].text, /SVG/)

  const svg = await mcp({ jsonrpc: '2.0', id: 43, method: 'tools/call', params: { name: 'create_rangka', arguments: { title: 'Dot', type: 'image', content: '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>' } } })
  const rangka = JSON.parse(svg.result.content[0].text)
  const preview = await fetch(`${baseUrl}/api/rangka/${rangka.id}/preview`, { headers: { authorization: `Bearer ${token}` } })
  assert.equal(preview.headers.get('content-type'), 'image/svg+xml')
})
