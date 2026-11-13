import { createHmac, timingSafeEqual } from 'crypto'
import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import { getServerConfig } from './config'

function secret() {
  return getServerConfig().shareSecret
}

export function signShareKey(rangkaId: string) {
  return createHmac('sha256', secret()).update(rangkaId).digest('hex')
}

export function isValidShareKey(rangkaId: string, key: string | undefined) {
  if (!key || !/^[a-f0-9]{64}$/.test(key)) return false
  const expected = Buffer.from(signShareKey(rangkaId), 'hex')
  const received = Buffer.from(key, 'hex')
  return expected.length === received.length && timingSafeEqual(expected, received)
}

/**
 * Canonical reader URL for a shared rangka.
 *
 * Private rangka have no reader entry point, so they get no URL. Unlisted
 * rangka carry the signed key; public rangka need no query parameter.
 * `PUBLIC_BASE_URL` wins when a proxy rewrites the request host, matching the
 * behavior of the dedicated share endpoint.
 */
export function rangkaShareUrl(
  event: H3Event,
  rangka: { id: string; slug: string; visibility: string },
): string | null {
  if (rangka.visibility === 'private') return null
  const baseUrl = getServerConfig().publicBaseUrl || getRequestURL(event).origin
  const key = rangka.visibility === 'unlisted' ? `?k=${signShareKey(rangka.id)}` : ''
  return `${baseUrl.replace(/\/+$/, '')}/share/${rangka.slug}${key}`
}

/**
 * Whether the caller may be handed share capability URLs.
 *
 * Minting a public/unlisted entry point is a write operation (see the
 * `/api/rangka/:id/share` endpoint). Listing and search must not leak the
 * signed unlisted key to a read-only agent, which would let it redistribute a
 * capability it cannot create. Browser sessions and write/full tokens may.
 */
export function callerCanManageShares(event: H3Event): boolean {
  const token = (event.context as any).apiToken
  return !token || token.scopes.includes('write') || token.scopes.includes('full')
}

/**
 * Caller-aware share URL for listing/search previews.
 *
 * Public URLs carry no secret, so any authenticated caller may see them.
 * Unlisted URLs embed the signed capability key and are withheld from callers
 * without write capability; private rangka never have a URL.
 */
export function rangkaShareUrlForCaller(
  event: H3Event,
  rangka: { id: string; slug: string; visibility: string },
): string | null {
  if (rangka.visibility === 'unlisted' && !callerCanManageShares(event)) return null
  return rangkaShareUrl(event, rangka)
}
