/**
 * Derives the Nuxt `appSecret` from the deployment's `JWT_SECRET`.
 *
 * Nuxt Auth Utils seals sessions with a key derived from `appSecret`. Rather
 * than requiring a fifth environment variable, we derive a dedicated secret
 * with HKDF-SHA256 and a fixed, versioned purpose. The result is:
 *
 *  - stable across restarts and redeployments (same input -> same output),
 *  - distinct from `JWT_SECRET` itself (domain separation), and
 *  - independent from the share-link HMAC (`SHARE_SECRET`).
 *
 * Rotating `JWT_SECRET` intentionally invalidates browser sessions.
 */
const PURPOSE = 'serangkai/app-secret/v1'
const SALT = 'serangkai/session-key'

export async function deriveSessionSecret(jwtSecret) {
  if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters to derive the session secret.')
  }
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(jwtSecret), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(SALT), info: encoder.encode(PURPOSE) },
    key,
    256,
  )
  return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
