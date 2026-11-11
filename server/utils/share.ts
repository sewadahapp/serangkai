import { createHmac, timingSafeEqual } from 'crypto'
import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import { getServerConfig } from './config'

function secret() {
  return getServerConfig().shareSecret
}

export function signShareKey(artifactId: string) {
  return createHmac('sha256', secret()).update(artifactId).digest('hex')
}

export function isValidShareKey(artifactId: string, key: string | undefined) {
  if (!key || !/^[a-f0-9]{64}$/.test(key)) return false
  const expected = Buffer.from(signShareKey(artifactId), 'hex')
  const received = Buffer.from(key, 'hex')
  return expected.length === received.length && timingSafeEqual(expected, received)
}

/**
 * Canonical reader URL for a shared artifact.
 *
 * Private artifacts have no reader entry point, so they get no URL. Unlisted
 * artifacts carry the signed key; public artifacts need no query parameter.
 * `PUBLIC_BASE_URL` wins when a proxy rewrites the request host, matching the
 * behavior of the dedicated share endpoint.
 */
export function artifactShareUrl(
  event: H3Event,
  artifact: { id: string; slug: string; visibility: string },
): string | null {
  if (artifact.visibility === 'private') return null
  const baseUrl = getServerConfig().publicBaseUrl || getRequestURL(event).origin
  const key = artifact.visibility === 'unlisted' ? `?k=${signShareKey(artifact.id)}` : ''
  return `${baseUrl.replace(/\/+$/, '')}/share/${artifact.slug}${key}`
}
