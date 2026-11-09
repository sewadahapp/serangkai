import { getRequestDatabase } from '../../db/adapter'
import {
  createDeviceAuthorization,
  findClient,
  normalizeScopes,
  OAUTH_SCOPES,
} from '../../utils/oauth'
import { absoluteUrl } from '../../utils/oauth-urls'
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

  const body = await readBody<Record<string, any>>(event).catch(() => ({}))
  const clientId = String(body?.client_id || '')
  if (!clientId) return deviceError(event, 400, 'invalid_request', 'client_id is required.')

  const db = await getRequestDatabase(event)
  const client = await findClient(db, clientId)
  if (!client) return deviceError(event, 400, 'invalid_client', 'Unknown client.')

  const scopes = normalizeScopes(body?.scope).filter(scope => (OAUTH_SCOPES as readonly string[]).includes(scope))
  if (!scopes.length) return deviceError(event, 400, 'invalid_scope', 'At least one supported scope is required.')

  const resource = typeof body?.resource === 'string' ? body.resource : null
  const authorization = await createDeviceAuthorization(db, { clientId: client.id, scopes, resource })

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
