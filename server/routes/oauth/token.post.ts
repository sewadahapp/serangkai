import { getRequestDatabase } from '../../db/adapter'
import { hashToken } from '../../utils/auth'
import {
  anyRedirectMatches,
  consumeAuthorizationCode,
  findClient,
  issueTokens,
  parseResourceIndicator,
  parseScopes,
  pollDeviceAuthorization,
  resourceMatches,
  rotateRefreshToken,
  timingSafeEqual,
  verifyPkce,
} from '../../utils/oauth'
import { mcpResourceUrl } from '../../utils/oauth-urls'
import { readBoundedBody } from '../../utils/request-body'
import { clientBucketKey, createRateLimiter } from '../../utils/rate-limit'

/**
 * OAuth 2.1 token endpoint.
 *
 * Handles only the authorization-code exchange and refresh-token rotation.
 * There is no client-credentials grant: an agent must be approved by the owner,
 * never self-issue access.
 *
 * Rate limiting matters here because a code is short and a client can be
 * scripted. Ten attempts per minute per address is far above a normal client
 * (which exchanges once, then refreshes hourly) and low enough to make
 * guessing pointless. Successful exchanges do not count against the bucket.
 */
const tokenLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 })

function tokenError(event: any, status: number, error: string, description: string) {
  setResponseStatus(event, status)
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Pragma', 'no-cache')
  return { error, error_description: description }
}

/** Token requests are tiny; a megabyte here is always an attack or a bug. */
const TOKEN_BODY_LIMIT = 16 * 1024

/** Read a request body from either a form post or JSON. */
async function readTokenRequest(event: any) {
  return readBoundedBody(event, { maxBytes: TOKEN_BODY_LIMIT })
}

/**
 * Confidential clients authenticate with a secret. Public clients (the MCP
 * norm) send only their client id and rely on PKCE, which is why `none` is an
 * accepted method.
 */
async function authenticateClient(event: any, db: any, body: Record<string, any>) {
  const clientId = String(body.client_id || '')
  if (!clientId) return { ok: false as const, error: 'invalid_client' as const }

  const client = await findClient(db, clientId)
  if (!client) return { ok: false as const, error: 'invalid_client' as const }

  if (client.tokenEndpointAuthMethod === 'client_secret_post') {
    const secret = typeof body.client_secret === 'string' ? body.client_secret : ''
    if (!secret) return { ok: false as const, error: 'invalid_client' as const }
    if (!client.clientSecretHash) return { ok: false as const, error: 'invalid_client' as const }
    const presented = await hashToken(secret)
    if (!timingSafeEqual(presented, client.clientSecretHash)) {
      return { ok: false as const, error: 'invalid_client' as const }
    }
  }

  return { ok: true as const, client }
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Pragma', 'no-cache')

  const bucket = clientBucketKey(event)
  const limit = tokenLimiter.hit(bucket)
  if (limit.limited) {
    setHeader(event, 'Retry-After', String(limit.retryAfterSeconds))
    return tokenError(event, 429, 'slow_down', 'Too many token requests. Try again shortly.')
  }

  let body: Record<string, any>
  try {
    body = await readTokenRequest(event)
  } catch (error: any) {
    const status = Number(error?.statusCode) === 413 ? 413 : 400
    return tokenError(event, status, 'invalid_request', 'The token request could not be read.')
  }

  // RFC 8707: a token may only be issued for this server's single MCP
  // resource. An omitted value defaults to it; any other audience is refused.
  const resourceResult = parseResourceIndicator(body.resource, mcpResourceUrl(event).href)
  if (!resourceResult.ok) {
    return tokenError(event, 400, 'invalid_target', 'The requested resource is not served by this authorization server.')
  }
  const resource = resourceResult.resource

  const db = await getRequestDatabase(event)
  const grantType = String(body.grant_type || '')
  const auth = await authenticateClient(event, db, body)
  if (!auth.ok) {
    setHeader(event, 'WWW-Authenticate', 'Basic realm="serangkai"')
    return tokenError(event, 401, 'invalid_client', 'Client authentication failed.')
  }
  const client = auth.client

  if (grantType === 'authorization_code') {
    const code = String(body.code || '')
    const redirectUri = String(body.redirect_uri || '')
    const codeVerifier = String(body.code_verifier || '')
    if (!code) return tokenError(event, 400, 'invalid_request', 'code is required.')
    if (!redirectUri) return tokenError(event, 400, 'invalid_request', 'redirect_uri is required.')
    if (!codeVerifier) return tokenError(event, 400, 'invalid_request', 'code_verifier is required.')

    const consumed = await consumeAuthorizationCode(db, code, resource)
    if (!consumed.ok) {
      if (consumed.error === 'invalid_target') {
        return tokenError(event, 400, 'invalid_target', 'The authorization code was issued for another resource.')
      }
      return tokenError(event, 400, 'invalid_grant', 'The authorization code is invalid or expired.')
    }
    const record = consumed.code

    // The code is bound to the client, the exact redirect URI, and the PKCE
    // challenge. Any mismatch invalidates it rather than falling back.
    if (record.clientId !== client.id) {
      return tokenError(event, 400, 'invalid_grant', 'The authorization code was issued to another client.')
    }
    if (!anyRedirectMatches(redirectUri, [record.redirectUri])) {
      return tokenError(event, 400, 'invalid_grant', 'redirect_uri does not match the authorization request.')
    }
    if (record.codeChallengeMethod !== 'S256') {
      return tokenError(event, 400, 'invalid_grant', 'Only the S256 PKCE method is supported.')
    }
    if (!await verifyPkce(record.codeChallenge, codeVerifier)) {
      return tokenError(event, 400, 'invalid_grant', 'The PKCE verifier does not match the challenge.')
    }
    // A code is bound to the resource the owner approved. Legacy codes carry
    // null and are bound to the canonical resource on exchange.
    if (record.resource && !resourceMatches(record.resource, resource)) {
      return tokenError(event, 400, 'invalid_target', 'The authorization code was issued for another resource.')
    }
    const scopes = parseScopes(record.scopes)
    if (!scopes.length) {
      return tokenError(event, 400, 'invalid_grant', 'The authorization code carries no grantable scopes.')
    }

    const issued = await issueTokens(db, {
      clientId: client.id,
      userId: record.userId,
      scopes,
      label: client.clientName || 'OAuth client',
      resource,
    })
    // A successful exchange clears the bucket: only failed attempts should
    // accumulate toward the limit.
    tokenLimiter.reset(bucket)
    return {
      access_token: issued.accessToken,
      token_type: 'Bearer',
      expires_in: issued.expiresIn,
      refresh_token: issued.refreshToken,
      scope: issued.scopes.join(' '),
    }
  }

  if (grantType === 'refresh_token') {
    const refreshToken = String(body.refresh_token || '')
    if (!refreshToken) return tokenError(event, 400, 'invalid_request', 'refresh_token is required.')

    const rotated = await rotateRefreshToken(db, refreshToken, client.id, resource)
    if (!rotated.ok) {
      if (rotated.error === 'invalid_target') {
        return tokenError(event, 400, 'invalid_target', 'The refresh token is not valid for this resource.')
      }
      return tokenError(event, 400, 'invalid_grant', 'The refresh token is invalid or expired.')
    }
    tokenLimiter.reset(bucket)
    return {
      access_token: rotated.tokens.accessToken,
      token_type: 'Bearer',
      expires_in: rotated.tokens.expiresIn,
      refresh_token: rotated.tokens.refreshToken,
      scope: rotated.tokens.scopes.join(' '),
    }
  }

  if (grantType === 'urn:ietf:params:oauth:grant-type:device_code') {
    const deviceCode = String(body.device_code || '')
    if (!deviceCode) return tokenError(event, 400, 'invalid_request', 'device_code is required.')

    const polled = await pollDeviceAuthorization(db, deviceCode, client.id, resource)
    if (!polled.ok) {
      // RFC 8628 error codes are what a polling client branches on:
      // authorization_pending means "keep waiting", the rest are terminal.
      const description = polled.error === 'authorization_pending'
        ? 'The owner has not approved this code yet.'
        : polled.error === 'access_denied'
          ? 'The owner declined this connection.'
          : polled.error === 'expired_token'
            ? 'The device code expired before it was approved.'
            : polled.error === 'invalid_target'
              ? 'The device code was issued for another resource.'
              : 'The device code is invalid.'
      return tokenError(event, 400, polled.error, description)
    }
    tokenLimiter.reset(bucket)
    return {
      access_token: polled.tokens.accessToken,
      token_type: 'Bearer',
      expires_in: polled.tokens.expiresIn,
      refresh_token: polled.tokens.refreshToken,
      scope: polled.tokens.scopes.join(' '),
    }
  }

  return tokenError(event, 400, 'unsupported_grant_type', 'Only authorization_code, refresh_token, and device_code are supported.')
})
