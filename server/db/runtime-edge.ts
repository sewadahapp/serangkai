/**
 * Cloudflare Workers must receive a request-scoped D1 binding. This module is
 * only a build-safe fallback for routes imported before a request context
 * exists; `getRequestDatabase` resolves D1 first.
 */
export function getDatabase(): never {
  throw new Error('A D1 binding is required on the Cloudflare runtime.')
}
