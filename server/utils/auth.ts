import { nanoid } from 'nanoid'

/**
 * API token generation and hashing.
 *
 * Browser sessions are owned by Nuxt Auth Utils; passwords are hashed with its
 * scrypt helpers (auto-imported). Only the token surface remains here.
 */
export function generateToken(): string {
  return nanoid(32)
}

export async function hashToken(token: string): Promise<string> {
  // Web Crypto keeps token hashing identical on Node, Workers, and Vercel.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
