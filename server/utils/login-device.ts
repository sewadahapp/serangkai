import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { H3Event } from 'h3'
import { getServerConfig } from './config'

/**
 * Known-device cookie for owner login (OWASP "device cookies").
 *
 * Behind a reverse proxy every visitor shares the proxy's address, so the
 * per-address login limit lets a stranger lock the owner out with a few wrong
 * passwords. A browser that has signed in before carries this signed cookie
 * and is throttled on its own bucket instead, so an attacker exhausting the
 * shared bucket cannot block it. The cookie authorizes nothing: it only picks
 * which rate-limit bucket a login attempt counts against.
 */
export const LOGIN_DEVICE_COOKIE = 'serangkai_device'
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60

function sign(id: string) {
  return createHmac('sha256', getServerConfig().jwtSecret)
    .update(`serangkai-login-device-v1:${id}`)
    .digest('hex')
}

/** The device id from a valid cookie, or undefined when absent or forged. */
export function readLoginDevice(event: H3Event): string | undefined {
  const value = getCookie(event, LOGIN_DEVICE_COOKIE) || ''
  const match = /^([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value)
  if (!match) return undefined
  const expected = Buffer.from(sign(match[1]), 'hex')
  const received = Buffer.from(match[2], 'hex')
  return timingSafeEqual(expected, received) ? match[1] : undefined
}

/** Issue (or refresh) the cookie after a successful login. */
export function rememberLoginDevice(event: H3Event, existing?: string) {
  const id = existing || randomBytes(16).toString('hex')
  setCookie(event, LOGIN_DEVICE_COOKIE, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV !== 'development',
    // Only the login endpoint ever needs it.
    path: '/api/auth/login',
    maxAge: MAX_AGE_SECONDS,
  })
}
