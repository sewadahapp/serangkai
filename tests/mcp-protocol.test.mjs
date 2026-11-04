import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'

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
  processHandle = spawn('node', ['.output/server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: randomBytes(32).toString('hex'),
      DATABASE_PATH: join(dataDir, 'serangkai.db'),
      STORAGE_PATH: join(dataDir, 'files'),
    },
    stdio: 'ignore',
  })
  await waitForServer()
  const email = `mcp-${randomBytes(4).toString('hex')}@example.com`
  const register = await jsonRequest('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password: 'correct horse battery' }) })
  assert.equal(register.user.email, email)
  const cookie = register
  // Login with a cookie jar is intentionally avoided; use the session cookie from a direct request below.
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct horse battery' }) })
  const session = loginResponse.headers.get('set-cookie')
  const tokenResponse = await jsonRequest('/api/tokens', { method: 'POST', headers: { cookie: session || '' }, body: JSON.stringify({ name: 'test', scopes: ['read', 'write'] }) })
  token = tokenResponse.token
  assert.ok(token)
  const readOnlyResponse = await jsonRequest('/api/tokens', { method: 'POST', headers: { cookie: session || '' }, body: JSON.stringify({ name: 'read-only', scopes: ['read'] }) })
  readOnlyToken = readOnlyResponse.token
})

after(async () => {
  processHandle?.kill('SIGTERM')
  await rm(dataDir, { recursive: true, force: true })
})

test('supports MCP initialization and tool discovery', async () => {
  const initialized = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } } })
  assert.equal(initialized.result.serverInfo.name, 'serangkai')
  assert.equal(initialized.result.protocolVersion, '2025-06-18')

  const tools = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  const names = tools.result.tools.map(tool => tool.name)
  assert.deepEqual(names, ['list_folders', 'create_folder', 'list_artifacts', 'get_artifact', 'create_artifact', 'update_artifact'])
})

test('creates and reads an artifact through MCP tools', async () => {
  const created = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'create_artifact', arguments: { title: 'Protocol Test', type: 'markdown', content: '# MCP', visibility: 'private' } } })
  const artifact = JSON.parse(created.result.content[0].text)
  assert.equal(artifact.title, 'Protocol Test')

  const read = await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_artifact', arguments: { id: artifact.id } } })
  const result = JSON.parse(read.result.content[0].text)
  assert.equal(result.content, '# MCP')
})

test('creates folders and files artifacts inside them through MCP tools', async () => {
  const folderResponse = await mcp({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'create_folder', arguments: { name: 'Reports' } } })
  const folder = JSON.parse(folderResponse.result.content[0].text)
  assert.equal(folder.path, '/Reports')

  const created = await mcp({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'create_artifact', arguments: { title: 'Folder artifact', type: 'markdown', content: '# Foldered', folderId: folder.id } } })
  const artifact = JSON.parse(created.result.content[0].text)
  assert.equal(artifact.folderId, folder.id)

  const listed = await mcp({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'list_folders', arguments: {} } })
  assert.equal(JSON.parse(listed.result.content[0].text)[0].name, 'Reports')

  const moved = await mcp({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'update_artifact', arguments: { id: artifact.id, folderId: null } } })
  assert.equal(JSON.parse(moved.result.content[0].text).folderId, null)
})

test('rejects MCP requests without authentication', async () => {
  const response = await fetch(`${baseUrl}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} }) })
  assert.equal(response.status, 401)
})

test('rejects write tools for read-only tokens', async () => {
  const response = await fetch(`${baseUrl}/api/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${readOnlyToken}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'create_artifact', arguments: { title: 'Denied', type: 'markdown', content: 'nope' } } }),
  })
  const body = await response.json()
  assert.equal(response.ok, true)
  assert.equal(body.result.isError, true)
  assert.match(body.result.content[0].text, /write scope/)
})
