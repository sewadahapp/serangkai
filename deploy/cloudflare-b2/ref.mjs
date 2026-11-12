import { existsSync, readFileSync } from 'node:fs'

/**
 * Source-ref resolution for the B2 deployment template.
 *
 * Order of precedence:
 *  1. SERANGKAI_REF env (explicit override — a branch for development, or a
 *     tag/commit for a deliberate upgrade). Always wins, so an operator's pin
 *     is never silently replaced by a template update.
 *  2. The committed `serangkai.ref` pin (an immutable commit or release tag),
 *     which makes default builds reproducible.
 *  3. The development branch, only when no pin is present.
 */
export const DEFAULT_BRANCH = 'master'

export function resolveRef({ env = process.env, pinFile } = {}) {
  const override = typeof env.SERANGKAI_REF === 'string' ? env.SERANGKAI_REF.trim() : ''
  if (override) return { ref: override, source: 'env' }
  if (pinFile && existsSync(pinFile)) {
    const pin = readFileSync(pinFile, 'utf8').trim()
    if (pin) return { ref: pin, source: 'pin' }
  }
  return { ref: DEFAULT_BRANCH, source: 'default' }
}
