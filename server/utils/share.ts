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
 * Bundle access keys travel in the URL path (`/api/share/<slug>/~<key>/…`).
 * A bundle runs in a sandboxed, opaque-origin frame: the browser sends no
 * session cookie with its own requests, and relative links drop a `?k=` query.
 * A path segment survives relative links, so every asset request carries it.
 *
 * Unlisted bundles use their share key. The owner's view of a private bundle
 * uses this short-lived key instead, minted only for a browser session.
 */
const BUNDLE_VIEW_TTL_SECONDS = 12 * 60 * 60

export function signBundleViewKey(rangkaId: string, now = Date.now()) {
  const expires = Math.floor(now / 1000) + BUNDLE_VIEW_TTL_SECONDS
  const signature = createHmac('sha256', secret()).update(`bundle-view:${rangkaId}:${expires}`).digest('hex')
  return `${expires}-${signature}`
}

export function isValidBundleViewKey(rangkaId: string, key: string | undefined, now = Date.now()) {
  const match = /^(\d{1,12})-([a-f0-9]{64})$/.exec(key || '')
  if (!match) return false
  const expires = Number(match[1])
  if (expires * 1000 <= now) return false
  const expected = createHmac('sha256', secret()).update(`bundle-view:${rangkaId}:${expires}`).digest()
  const received = Buffer.from(match[2]!, 'hex')
  return expected.length === received.length && timingSafeEqual(expected, received)
}

/**
 * Front page of a bundle for a caller who may already open it. The key goes in
 * the path: the share key for an unlisted link, a view key for the owner's
 * browser session, none for a public bundle.
 */
export function bundleEntryUrl(event: H3Event, rangka: { id: string; slug: string; visibility: string; userId: string }, shareKey = '') {
  const base = `/api/share/${rangka.slug}`
  if (rangka.visibility === 'public') return `${base}/index.html`
  if (rangka.visibility === 'unlisted' && isValidShareKey(rangka.id, shareKey)) return `${base}/~${shareKey}/index.html`
  const user = (event.context as any).user
  const isSession = !(event.context as any).apiToken
  if (user?.id === rangka.userId && isSession) return `${base}/~${signBundleViewKey(rangka.id)}/index.html`
  return null
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
