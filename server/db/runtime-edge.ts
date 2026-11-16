/**
 * Cloudflare Workers use a request-scoped D1 binding or opt into Turso. This module is
 * only a build-safe fallback for routes imported before a request context
 * exists; `getRequestDatabase` resolves Turso or D1 first.
 */
export function getDatabase(): never {
  throw new Error('A D1 binding or DATABASE_DRIVER=turso is required on the Cloudflare runtime.')
}
