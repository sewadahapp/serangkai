import { nanoid } from 'nanoid'
import { oauthClients } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { generateToken, hashToken } from '../../utils/auth'
import { isAcceptableRedirectUri, normalizeScopes, parseScopes, pruneAbandonedClients } from '../../utils/oauth'
import { readBoundedBody } from '../../utils/request-body'
import { clientBucketKey, createRateLimiter } from '../../utils/rate-limit'

/**
 * RFC 7591 dynamic client registration.
 *
 * MCP clients register themselves before the browser flow, so this endpoint has
 * to be open. That makes it the untrusted edge: registration alone grants
 * nothing, the owner still has to approve the client on the consent screen, and
 * a registered client is useless without that approval. The rate limit below
 * exists to keep the table from being filled by a script.
 */
function positiveInt(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

// Environment overrides exist for test isolation; production defaults stay
// deliberately tight because registration is unauthenticated.
const registrationLimiter = createRateLimiter({
  limit: positiveInt('SERANGKAI_OAUTH_REGISTER_RATE_LIMIT', 20),
  windowMs: positiveInt('SERANGKAI_OAUTH_REGISTER_RATE_WINDOW_MS', 60 * 60 * 1000),
})

const MAX_REDIRECT_URIS = 10
const MAX_REDIRECT_URI_LENGTH = 2048
const MAX_METADATA_LENGTH = 500

/** The grant types this server implements. */
const SUPPORTED_GRANTS = [
  'authorization_code',
  'refresh_token',
  'urn:ietf:params:oauth:grant-type:device_code',
]

const SUPPORTED_AUTH_METHODS = ['none', 'client_secret_post']

function registrationError(event: any, status: number, error: string, description: string) {
  setResponseStatus(event, status)
  return { error, error_description: description }
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Cache-Control', 'no-store')

  const limit = registrationLimiter.hit(clientBucketKey(event))
  if (limit.limited) {
    setHeader(event, 'Retry-After', String(limit.retryAfterSeconds))
    return registrationError(event, 429, 'too_many_requests', 'Too many registration attempts. Try again later.')
  }

  let body: any
  try {
    // Registration metadata is small. A 32 KiB cap covers every legitimate
    // client and refuses oversized redirect lists before they reach the DB.
    body = await readBoundedBody(event, { maxBytes: 32 * 1024, parse: 'json' })
  } catch (error: any) {
    if (Number(error?.statusCode) === 413) {
      return registrationError(event, 413, 'invalid_client_metadata', 'The registration request is too large.')
    }
    if (Number(error?.statusCode) === 415) {
      return registrationError(event, 415, 'invalid_client_metadata', 'The request body must be JSON.')
    }
    return registrationError(event, 400, 'invalid_client_metadata', 'The request body must be a JSON object.')
  }
  if (!body || typeof body !== 'object') {
    return registrationError(event, 400, 'invalid_client_metadata', 'The request body must be a JSON object.')
  }

  if (body.redirect_uris !== undefined && !Array.isArray(body.redirect_uris)) {
    return registrationError(event, 400, 'invalid_redirect_uri', 'redirect_uris must be an array.')
  }
  const redirectUris: string[] = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
  if (!redirectUris.length) {
    return registrationError(event, 400, 'invalid_redirect_uri', 'At least one redirect_uri is required.')
  }
  if (redirectUris.length > MAX_REDIRECT_URIS) {
    return registrationError(event, 400, 'invalid_redirect_uri', `At most ${MAX_REDIRECT_URIS} redirect URIs are allowed.`)
  }
  for (const uri of redirectUris) {
    if (typeof uri !== 'string' || uri.length > MAX_REDIRECT_URI_LENGTH) {
      return registrationError(event, 400, 'invalid_redirect_uri', 'Each redirect_uri must be a short string.')
    }
    if (!isAcceptableRedirectUri(uri)) {
      return registrationError(event, 400, 'invalid_redirect_uri', `Redirect URI is not allowed: ${uri}`)
    }
  }
  // Duplicate callbacks add nothing and make the exact match harder to reason
  // about, so normalize the list.
  const uniqueRedirects = [...new Set(redirectUris)]

  // Only grant types/response types this server actually implements.
  if (body.grant_types !== undefined && !Array.isArray(body.grant_types)) {
    return registrationError(event, 400, 'invalid_client_metadata', 'grant_types must be an array.')
  }
  if (body.response_types !== undefined && !Array.isArray(body.response_types)) {
    return registrationError(event, 400, 'invalid_client_metadata', 'response_types must be an array.')
  }
  const grantTypes = Array.isArray(body.grant_types) && body.grant_types.length
    ? body.grant_types.map(String)
    : ['authorization_code', 'refresh_token']
  // A client using the device flow registers with the device grant type, so
  // rejecting it would break exactly the headless path this exists for.
  const unsupportedGrant = grantTypes.find((value: string) => !SUPPORTED_GRANTS.includes(value))
  if (unsupportedGrant) {
    return registrationError(event, 400, 'invalid_client_metadata', `Unsupported grant type: ${unsupportedGrant}`)
  }
  const responseTypes = Array.isArray(body.response_types) && body.response_types.length
    ? body.response_types.map(String)
    : ['code']
  if (responseTypes.some((value: string) => value !== 'code')) {
    return registrationError(event, 400, 'invalid_client_metadata', 'Only the "code" response type is supported.')
  }

  // Reject an authentication method we cannot actually verify. Silently
  // downgrading `client_secret_basic` to `none` would make a confidential
  // client public without telling anyone.
  if (body.token_endpoint_auth_method !== undefined
    && !SUPPORTED_AUTH_METHODS.includes(body.token_endpoint_auth_method)) {
    return registrationError(
      event,
      400,
      'invalid_client_metadata',
      `Unsupported token_endpoint_auth_method: ${String(body.token_endpoint_auth_method)}`,
    )
  }
  const authMethod = body.token_endpoint_auth_method === 'client_secret_post' ? 'client_secret_post' : 'none'

  let clientName: string | null = null
  if (body.client_name !== undefined) {
    if (typeof body.client_name !== 'string' || body.client_name.length > 200) {
      return registrationError(event, 400, 'invalid_client_metadata', 'client_name must be a short string.')
    }
    clientName = body.client_name
  }
  let clientUri: string | null = null
  if (body.client_uri !== undefined) {
    if (typeof body.client_uri !== 'string' || body.client_uri.length > MAX_METADATA_LENGTH) {
      return registrationError(event, 400, 'invalid_client_metadata', 'client_uri must be a short string.')
    }
    try {
      const parsed = new URL(body.client_uri)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('scheme')
      clientUri = body.client_uri
    } catch {
      return registrationError(event, 400, 'invalid_client_metadata', 'client_uri must be an HTTP(S) URL.')
    }
  }

  const requestedScopes = normalizeScopes(body.scope)
  // `parseScopes` already drops `full`; this also rejects a malformed scope
  // value instead of silently handing back the default pair.
  if (body.scope !== undefined && typeof body.scope !== 'string' && !Array.isArray(body.scope)) {
    return registrationError(event, 400, 'invalid_client_metadata', 'scope must be a string.')
  }
  if (body.scope !== undefined && !parseScopes(body.scope).length) {
    return registrationError(event, 400, 'invalid_client_metadata', 'No supported scope was requested.')
  }

  const db = await getRequestDatabase(event)
  const clientId = nanoid()
  const clientSecret = authMethod === 'client_secret_post' ? generateToken() : null

  await db.insert(oauthClients).values({
    id: clientId,
    clientName,
    clientUri,
    redirectUris: uniqueRedirects,
    scopes: requestedScopes,
    tokenEndpointAuthMethod: authMethod,
    clientSecretHash: clientSecret ? await hashToken(clientSecret) : null,
    createdAt: new Date(),
  })

  // Opportunistic housekeeping: abandoned sign-ins would otherwise leave rows
  // behind forever. Approved clients are never touched.
  pruneAbandonedClients(db).catch(() => {})

  setResponseStatus(event, 201)
  return {
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: uniqueRedirects,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: authMethod,
    ...(clientName !== null ? { client_name: clientName } : {}),
    ...(clientUri !== null ? { client_uri: clientUri } : {}),
    scope: requestedScopes.join(' '),
  }
})
