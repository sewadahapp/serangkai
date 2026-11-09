import { nanoid } from 'nanoid'
import { oauthClients } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { readBody } from 'h3'
import { generateToken, hashToken } from '../../utils/auth'
import { isAcceptableRedirectUri, normalizeScopes, pruneAbandonedClients } from '../../utils/oauth'
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
const registrationLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 })

/** The grant types this server implements. */
const SUPPORTED_GRANTS = [
  'authorization_code',
  'refresh_token',
  'urn:ietf:params:oauth:grant-type:device_code',
]

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
    body = await readBody(event)
  } catch {
    return registrationError(event, 400, 'invalid_client_metadata', 'The request body must be JSON.')
  }
  if (!body || typeof body !== 'object') {
    return registrationError(event, 400, 'invalid_client_metadata', 'The request body must be a JSON object.')
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.map((value: unknown) => String(value))
    : []
  if (!redirectUris.length) {
    return registrationError(event, 400, 'invalid_redirect_uri', 'At least one redirect_uri is required.')
  }
  for (const uri of redirectUris) {
    if (!isAcceptableRedirectUri(uri)) {
      return registrationError(event, 400, 'invalid_redirect_uri', `Redirect URI is not allowed: ${uri}`)
    }
  }
  // Duplicate callbacks add nothing and make the exact match harder to reason
  // about, so normalize the list.
  const uniqueRedirects = [...new Set(redirectUris)]

  // Only grant types/response types this server actually implements.
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

  const requestedScopes = normalizeScopes(body.scope)
  const authMethod = body.token_endpoint_auth_method === 'client_secret_post' ? 'client_secret_post' : 'none'

  const db = await getRequestDatabase(event)
  const clientId = nanoid()
  const clientSecret = authMethod === 'client_secret_post' ? generateToken() : null

  await db.insert(oauthClients).values({
    id: clientId,
    clientName: typeof body.client_name === 'string' ? body.client_name.slice(0, 200) : null,
    clientUri: typeof body.client_uri === 'string' ? body.client_uri.slice(0, 500) : null,
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
    ...(typeof body.client_name === 'string' ? { client_name: body.client_name } : {}),
    ...(typeof body.client_uri === 'string' ? { client_uri: body.client_uri } : {}),
    scope: requestedScopes.join(' '),
  }
})
