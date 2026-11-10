import { generateToken } from './auth'

/**
 * Session-bound consent state, shared by the authorization-code and device
 * flows.
 *
 * The GET that renders a consent page stores a fingerprint of the exact request
 * plus a random nonce in the sealed session; the POST must present both. A
 * cross-site form can replay visible fields but cannot read the nonce, and the
 * fingerprint makes a stolen nonce useless for a different request. No
 * client-side JavaScript is involved.
 */

/** How long a rendered consent page may be submitted. */
const CONSENT_TTL_MS = 10 * 60 * 1000
const MAX_CONSENT_STATES = 8

interface ConsentState {
  hash: string
  nonce: string
  userId: string
  expiresAt: number
}

function liveStates(session: any, now: number): ConsentState[] {
  return Array.isArray(session?.oauthConsent)
    ? session.oauthConsent.filter((state: ConsentState) =>
      state && typeof state.hash === 'string'
      && typeof state.nonce === 'string'
      && typeof state.userId === 'string'
      && Number(state.expiresAt) > now)
    : []
}

/**
 * Remember the exact request a GET rendered, inside the sealed session.
 *
 * Keeping a short list instead of one value lets the owner open several
 * clients in different tabs without the last page invalidating the others.
 */
export async function rememberConsent(event: any, hash: string, userId: string): Promise<string> {
  const session: any = await getUserSession(event)
  const now = Date.now()
  const states = liveStates(session, now)
  const nonce = generateToken()
  states.push({ hash, nonce, userId, expiresAt: now + CONSENT_TTL_MS })
  await replaceConsentStates(event, session, states.slice(-MAX_CONSENT_STATES))
  return nonce
}

/** Consume a previously rendered consent state exactly once. */
export async function consumeConsent(event: any, hash: string, userId: string, nonce: string): Promise<boolean> {
  const session: any = await getUserSession(event)
  const states = liveStates(session, Date.now())
  const index = states.findIndex(state =>
    state.hash === hash && state.userId === userId && state.nonce === nonce)
  if (index < 0) return false
  states.splice(index, 1)
  await replaceConsentStates(event, session, states)
  return true
}

// setUserSession merges via defu, which concatenates arrays: writing the
// trimmed list through it duplicates states and resurrects consumed nonces.
// Replace the session instead, preserving the login data.
async function replaceConsentStates(event: any, session: any, states: ConsentState[]) {
  const data = { ...session, oauthConsent: states }
  delete data.id // getUserSession adds the session id; it is not session data
  await replaceUserSession(event, data)
}