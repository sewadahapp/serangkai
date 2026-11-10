import { getRequestDatabase } from '../../db/adapter'
import {
  createDeviceAuthorization,
  DEFAULT_OAUTH_SCOPES,
  findClient,
  normalizeScopes,
  parseResourceIndicator,
  parseScopes,
} from '../../utils/oauth'
import { absoluteUrl, mcpResourceUrl } from '../../utils/oauth-urls'
import { readBoundedBody } from '../../utils/request-body'
import { clientBucketKey, createRateLimiter } from '../../utils/rate-limit'

/**
 * RFC 8628 device authorization endpoint.
 *
 * A client that cannot receive a loopback callback (SSH session, container,
 * cron job) calls this, prints the returned `user_code`, and polls the token
 * endpoint. The owner approves the code in a browser on any machine.
 */
const deviceLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 })

function deviceError(event: any, status: number, error: string, description: string) {
  setResponseStatus(event, status)
  setHeader(event, 'Cache-Control', 'no-store')
  return { error, error_description: description }
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Cache-Control', 'no-store')

  const limit = deviceLimiter.hit(clientBucketKey(event))
  if (limit.limited) {
    setHeader(event, 'Retry-After', String(limit.retryAfterSeconds))
    return deviceError(event, 429, 'slow_down', 'Too many device authorization requests.')
  }

  let body: Record<string, any>
  try {
    body = await readBoundedBody(event, { maxBytes: 16 * 1024 })
  } catch (error: any) {
    const status = Number(error?.statusCode) === 413 ? 413 : 400
    return deviceError(event, status, 'invalid_request', 'The device authorization request could not be read.')
  }
  const clientId = String(body?.client_id || '')
  if (!clientId) return deviceError(event, 400, 'invalid_request', 'client_id is required.')

  const resourceResult = parseResourceIndicator(body?.resource, mcpResourceUrl(event).href)
  if (!resourceResult.ok) {
    return deviceError(event, 400, 'invalid_target', 'The requested resource is not served by this authorization server.')
  }

  const db = await getRequestDatabase(event)
  const client = await findClient(db, clientId)
  if (!client) return deviceError(event, 400, 'invalid_client', 'Unknown client.')

  // A client cannot ask for more than it registered for. Legacy rows with no
  // registered scopes keep the historical default.
  const registered = parseScopes(client.scopes)
  const allowed = registered.length ? registered : DEFAULT_OAUTH_SCOPES
  const scopes = normalizeScopes(body?.scope).filter(scope => allowed.includes(scope))
  if (!scopes.length) return deviceError(event, 400, 'invalid_scope', 'At least one supported scope is required.')

  const authorization = await createDeviceAuthorization(db, {
    clientId: client.id,
    scopes,
    resource: resourceResult.resource,
  })
  if (!authorization.ok) {
    setHeader(event, 'Retry-After', '60')
    return deviceError(event, 429, 'slow_down', 'Too many pending codes for this client. Wait for them to expire.')
  }

  // `verification_uri_complete` saves the owner from typing the code, which is
  // the whole point when the client is on another machine.
  const verificationUri = absoluteUrl(event, '/oauth/device').href
  return {
    device_code: authorization.deviceCode,
    user_code: authorization.userCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?user_code=${encodeURIComponent(authorization.userCode)}`,
    expires_in: authorization.expiresIn,
    interval: 5,
  }
})
