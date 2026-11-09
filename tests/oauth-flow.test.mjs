import assert from 'node:assert/strict'
import { randomBytes, createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { test, before, after } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login } from './helpers/auth.mjs'

/**
 * End-to-end OAuth authorization-server coverage.
 *
 * Drives the same requests a real MCP client makes: discovery from the 401
 * header, dynamic registration, the consent round-trip, the PKCE token
 * exchange, a call to the MCP endpoint with the granted token, refresh
 * rotation, and revocation. Nothing here is stubbed, so a regression in the
 * handshake fails the suite rather than a documentation claim.
 */

const port = 3980 + Math.floor(Math.random() * 100)
const base = `http://127.0.0.1:${port}`
let child, dataDir, cookie

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'serangkai-oauth-test-'))
  child = spawn(serverRuntime, ['.output/server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      ...adminEnv(),
      PORT: String(port),
      JWT_SECRET: randomBytes(32).toString('hex'),
      SHARE_SECRET: randomBytes(32).toString('hex'),
      DATABASE_PATH: join(dataDir, 'serangkai.db'),
      STORAGE_PATH: join(dataDir, 'files'),
    },
    stdio: 'ignore',
  })
  let healthy = false
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!healthy) throw new Error('OAuth test server did not become healthy')
  cookie = (await login(base)).cookie
})

after(async () => {
  child?.kill('SIGTERM')
  await rm(dataDir, { recursive: true, force: true })
})

/** RFC 7636 S256 verifier/challenge pair. */
function pkcePair() {
  const verifier = randomBytes(48).toString('base64url').slice(0, 64)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

async function registerClient(redirectUri, overrides = {}) {
  const response = await fetch(`${base}/oauth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: 'Test MCP client',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      ...overrides,
    }),
  })
  return { response, body: await response.json() }
}

/**
 * Approve an authorization request the way the consent form does. The form
 * submits one `scopes` entry per checked box, so the helper has to as well;
 * omitting them means the owner unchecked everything.
 */
async function authorize({ clientId, redirectUri, challenge, scope = 'read write', state = 'xyz', decision = 'approve', scopes = scope }) {
  const body = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope,
    state,
    decision,
  })
  if (decision === 'approve') {
    for (const value of String(scopes).split(/\s+/).filter(Boolean)) body.append('scopes', value)
  }
  return fetch(`${base}/oauth/authorize`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  })
}

async function exchangeCode({ clientId, code, redirectUri, verifier }) {
  const response = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })
  return { response, body: await response.json() }
}

test('the MCP endpoint advertises OAuth discovery from its 401', async () => {
  const response = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  })
  assert.equal(response.status, 401)
  const header = response.headers.get('www-authenticate') || ''
  assert.match(header, /^Bearer /)
  assert.match(header, /resource_metadata="http:\/\/127\.0\.0\.1:\d+\/\.well-known\/oauth-protected-resource\/api\/mcp"/)

  // The advertised document must itself resolve.
  const metadataUrl = header.match(/resource_metadata="([^"]+)"/)?.[1]
  const metadata = await (await fetch(metadataUrl)).json()
  assert.equal(metadata.resource, `${base}/api/mcp`)
  assert.deepEqual(metadata.authorization_servers, [`${base}/`])
  assert.deepEqual(metadata.scopes_supported, ['read', 'write'])
})

test('discovery documents describe this origin', async () => {
  const protectedResource = await (await fetch(`${base}/.well-known/oauth-protected-resource/api/mcp`)).json()
  assert.equal(protectedResource.resource, `${base}/api/mcp`)

  const metadata = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json()
  // RFC 8414: issuer carries no trailing slash or query.
  assert.equal(metadata.issuer, base)
  assert.equal(metadata.authorization_endpoint, `${base}/oauth/authorize`)
  assert.equal(metadata.token_endpoint, `${base}/oauth/token`)
  assert.equal(metadata.registration_endpoint, `${base}/oauth/register`)
  assert.equal(metadata.revocation_endpoint, `${base}/oauth/revoke`)
  assert.deepEqual(metadata.response_types_supported, ['code'])
  assert.deepEqual(metadata.code_challenge_methods_supported, ['S256'])
  assert.deepEqual(metadata.scopes_supported, ['read', 'write'])
  // An agent must never be able to mint credentials.
  assert.ok(!metadata.scopes_supported.includes('full'))

  // The OIDC-style alias serves the same document for clients that try it.
  const alias = await (await fetch(`${base}/.well-known/openid-configuration`)).json()
  assert.equal(alias.issuer, metadata.issuer)
})

test('registration validates redirect URIs and never grants admin scope', async () => {
  const insecure = await registerClient('http://evil.example/callback')
  assert.equal(insecure.response.status, 400)
  assert.equal(insecure.body.error, 'invalid_redirect_uri')

  const fragment = await registerClient('https://app.example/callback#token')
  assert.equal(fragment.response.status, 400)

  const loopback = await registerClient('http://127.0.0.1:33418/callback')
  assert.equal(loopback.response.status, 201)

  // Asking for full must not yield it: the registered scopes drop it.
  const escalated = await registerClient('https://app.example/cb', { scope: 'read write full' })
  assert.equal(escalated.response.status, 201)
  assert.equal(escalated.body.scope, 'read write')
})

test('a full code exchange issues working tokens, and the code cannot be replayed', async () => {
  const redirectUri = 'https://client.example/callback'
  const { body: client } = await registerClient(redirectUri)
  const { verifier, challenge } = pkcePair()

  const approval = await authorize({ clientId: client.client_id, redirectUri, challenge })
  assert.equal(approval.status, 302)
  const location = new URL(approval.headers.get('location'))
  assert.equal(location.origin + location.pathname, redirectUri)
  assert.equal(location.searchParams.get('state'), 'xyz')
  const code = location.searchParams.get('code')
  assert.ok(code)

  const { response, body: tokens } = await exchangeCode({ clientId: client.client_id, code, redirectUri, verifier })
  assert.equal(response.status, 200)
  assert.equal(tokens.token_type, 'Bearer')
  assert.ok(tokens.access_token)
  assert.ok(tokens.refresh_token)
  assert.equal(tokens.scope, 'read write')

  // The token works against the real MCP endpoint.
  const mcp = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  })
  assert.equal(mcp.status, 200)
  assert.match(await mcp.text(), /list_artifacts|search/)

  // Replaying the same code must fail: it was consumed by the exchange above.
  const replay = await exchangeCode({ clientId: client.client_id, code, redirectUri, verifier })
  assert.equal(replay.response.status, 400)
  assert.equal(replay.body.error, 'invalid_grant')
})

test('PKCE, client binding, and redirect URI are all enforced', async () => {
  const redirectUri = 'https://client.example/callback'
  const { body: client } = await registerClient(redirectUri)
  const { body: otherClient } = await registerClient('https://other.example/callback')

  const open = async () => {
    const { verifier, challenge } = pkcePair()
    const approval = await authorize({ clientId: client.client_id, redirectUri, challenge })
    const code = new URL(approval.headers.get('location')).searchParams.get('code')
    return { verifier, code }
  }

  // Wrong verifier.
  {
    const { code } = await open()
    const { response, body } = await exchangeCode({ clientId: client.client_id, code, redirectUri, verifier: 'x'.repeat(64) })
    assert.equal(response.status, 400)
    assert.equal(body.error, 'invalid_grant')
  }

  // Code presented by a different client.
  {
    const { verifier, code } = await open()
    const { response } = await exchangeCode({ clientId: otherClient.client_id, code, redirectUri, verifier })
    assert.equal(response.status, 400)
  }

  // Mismatched redirect_uri at exchange time.
  {
    const { verifier, code } = await open()
    const { response } = await exchangeCode({ clientId: client.client_id, code, redirectUri: 'https://client.example/other', verifier })
    assert.equal(response.status, 400)
  }
})

test('an unregistered redirect URI is refused instead of redirected to', async () => {
  const { body: client } = await registerClient('https://client.example/callback')
  const { challenge } = pkcePair()
  const response = await authorize({
    clientId: client.client_id,
    redirectUri: 'https://attacker.example/steal',
    challenge,
  })
  // Refusing with an error page (not a redirect) is the point.
  assert.equal(response.status, 400)
  assert.equal(response.headers.get('location'), null)
})

test('the consent page requires a signed-in owner', async () => {
  const { body: client } = await registerClient('https://client.example/callback')
  const { challenge } = pkcePair()
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: 'https://client.example/callback',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'read',
    state: 'abc',
  })
  const response = await fetch(`${base}/oauth/authorize?${query}`, { redirect: 'manual' })
  assert.equal(response.status, 302)
  const location = response.headers.get('location') || ''
  assert.match(location, /^\/auth\/login\?redirect=/)
  // The login redirect must carry the whole authorization request back.
  const target = decodeURIComponent(location.split('redirect=')[1])
  assert.match(target, /^\/oauth\/authorize\?/)
  assert.match(target, new RegExp(`client_id=${client.client_id}`))
})

test('denying consent returns access_denied without a code', async () => {
  const redirectUri = 'https://client.example/callback'
  const { body: client } = await registerClient(redirectUri)
  const { challenge } = pkcePair()
  const response = await authorize({ clientId: client.client_id, redirectUri, challenge, decision: 'deny' })
  assert.equal(response.status, 302)
  const location = new URL(response.headers.get('location'))
  assert.equal(location.searchParams.get('error'), 'access_denied')
  assert.equal(location.searchParams.get('code'), null)
  assert.equal(location.searchParams.get('state'), 'xyz')
})

test('unchecking a scope on the consent page narrows the grant', async () => {
  const redirectUri = 'https://client.example/callback'
  const { body: client } = await registerClient(redirectUri)
  const pair = pkcePair()

  // The client asks for read+write, the owner approves only read. A single
  // checked box serializes as one string, which used to be discarded in favour
  // of the full request.
  const approval = await fetch(`${base}/oauth/authorize`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      code_challenge: pair.challenge,
      code_challenge_method: 'S256',
      scope: 'read write',
      state: 'narrow',
      decision: 'approve',
      scopes: 'read',
    }),
    redirect: 'manual',
  })
  assert.equal(approval.status, 302)
  const code = new URL(approval.headers.get('location')).searchParams.get('code')
  const { body: narrowed } = await exchangeCode({ clientId: client.client_id, code, redirectUri, verifier: pair.verifier })
  assert.equal(narrowed.scope, 'read')

  // A read-only grant cannot write, even though the client asked to. The MCP
  // transport reports tool failures inside a 200 JSON-RPC result, so the body
  // carries the refusal rather than the HTTP status.
  const write = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${narrowed.access_token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'create_artifact', arguments: { title: 'Nope', type: 'markdown', content: '# Nope' } },
    }),
  })
  assert.equal(write.status, 200)
  const payload = await write.text()
  assert.match(payload, /write scope/i)
  assert.doesNotMatch(payload, /"id":\s*"[A-Za-z0-9_-]{21}"/)
})

test('unchecking every scope is refused rather than defaulting to full access', async () => {
  const redirectUri = 'https://client.example/callback'
  const { body: client } = await registerClient(redirectUri)
  const { challenge } = pkcePair()

  const response = await fetch(`${base}/oauth/authorize`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'read write',
      state: 'none',
      decision: 'approve',
      // No `scopes` field at all: every box was unchecked.
    }),
    redirect: 'manual',
  })
  assert.equal(response.status, 400)
  assert.equal(response.headers.get('location'), null)
})

test('refresh tokens rotate and the old one stops working', async () => {
  const redirectUri = 'https://client.example/callback'
  const { body: client } = await registerClient(redirectUri)
  const { verifier, challenge } = pkcePair()
  const approval = await authorize({ clientId: client.client_id, redirectUri, challenge })
  const code = new URL(approval.headers.get('location')).searchParams.get('code')
  const { body: first } = await exchangeCode({ clientId: client.client_id, code, redirectUri, verifier })

  const refresh = async (refreshToken) => {
    const response = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: client.client_id,
        refresh_token: refreshToken,
      }),
    })
    return { response, body: await response.json() }
  }

  const rotated = await refresh(first.refresh_token)
  assert.equal(rotated.response.status, 200)
  assert.ok(rotated.body.access_token)
  assert.notEqual(rotated.body.refresh_token, first.refresh_token)

  // The rotated-out refresh token is dead.
  const replay = await refresh(first.refresh_token)
  assert.equal(replay.response.status, 400)
  assert.equal(replay.body.error, 'invalid_grant')

  // The new access token works.
  const mcp = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${rotated.body.access_token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  })
  assert.equal(mcp.status, 200)
})

test('revoking a token disconnects the whole grant', async () => {
  const redirectUri = 'https://client.example/callback'
  const { body: client } = await registerClient(redirectUri)
  const { verifier, challenge } = pkcePair()
  const approval = await authorize({ clientId: client.client_id, redirectUri, challenge })
  const code = new URL(approval.headers.get('location')).searchParams.get('code')
  const { body: tokens } = await exchangeCode({ clientId: client.client_id, code, redirectUri, verifier })

  // It appears in the owner's connected clients list.
  const listed = await (await fetch(`${base}/api/oauth/clients`, { headers: { cookie } })).json()
  const grant = listed.clients.find(entry => entry.scopes.includes('read'))
  assert.ok(grant, 'the approved client should be listed')
  assert.equal(grant.name, 'Test MCP client')

  // Revocation is uniform: unknown tokens get the same empty 200.
  assert.equal((await fetch(`${base}/oauth/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: 'not-a-real-token' }),
  })).status, 200)

  const revoked = await fetch(`${base}/oauth/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: tokens.access_token }),
  })
  assert.equal(revoked.status, 200)

  const after = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  })
  assert.equal(after.status, 401)

  // The refresh token died with the grant.
  const refresh = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: client.client_id,
      refresh_token: tokens.refresh_token,
    }),
  })
  assert.equal(refresh.status, 400)
})

test('the owner can disconnect a client from Settings', async () => {
  const redirectUri = 'https://client.example/callback'
  const { body: client } = await registerClient(redirectUri)
  const { verifier, challenge } = pkcePair()
  const approval = await authorize({ clientId: client.client_id, redirectUri, challenge })
  const code = new URL(approval.headers.get('location')).searchParams.get('code')
  const { body: tokens } = await exchangeCode({ clientId: client.client_id, code, redirectUri, verifier })

  const listed = await (await fetch(`${base}/api/oauth/clients`, { headers: { cookie } })).json()
  const grant = listed.clients.find(entry => entry.clientId === client.client_id)
  assert.ok(grant)

  const removed = await fetch(`${base}/api/oauth/clients/${grant.id}`, { method: 'DELETE', headers: { cookie } })
  assert.equal(removed.status, 200)

  const mcp = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  })
  assert.equal(mcp.status, 401)
})

test('an unauthenticated caller cannot list or disconnect OAuth clients', async () => {
  assert.equal((await fetch(`${base}/api/oauth/clients`)).status, 401)
  assert.equal((await fetch(`${base}/api/oauth/clients/anything`, { method: 'DELETE' })).status, 401)

  // A bearer token is an agent, never a browser session.
  const { body: client } = await registerClient('https://client.example/cb')
  const { verifier, challenge } = pkcePair()
  const approval = await authorize({ clientId: client.client_id, redirectUri: 'https://client.example/cb', challenge })
  const code = new URL(approval.headers.get('location')).searchParams.get('code')
  const { body: tokens } = await exchangeCode({ clientId: client.client_id, code, redirectUri: 'https://client.example/cb', verifier })
  assert.equal((await fetch(`${base}/api/oauth/clients`, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  })).status, 401)
})
