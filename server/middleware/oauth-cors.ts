/**
 * CORS for the OAuth surface and the MCP endpoint.
 *
 * MCP clients are usually native processes, where CORS does not apply. A
 * browser-based client is different: discovery, registration, and token
 * exchange are cross-origin fetches, and the MCP endpoint itself needs an
 * `Authorization` header, which always triggers a preflight. Without these
 * headers the browser blocks the request before the server ever sees it.
 *
 * Safety notes:
 *  - `Access-Control-Allow-Origin: *` is paired with **no**
 *    `Access-Control-Allow-Credentials`, so a cross-origin page can never
 *    borrow the owner's session cookie.
 *  - The MCP endpoint authenticates with a bearer token and explicitly rejects
 *    cookie-only requests, so exposing it to other origins grants nothing
 *    beyond what the caller already holds.
 *  - `WWW-Authenticate` is exposed so a browser client can read the
 *    `resource_metadata` URL that starts the OAuth flow.
 */
const ALLOWED_METHODS = 'GET, POST, OPTIONS'
// `authorization` is the agent credential; the MCP headers are part of the
// Streamable HTTP transport.
const ALLOWED_HEADERS = 'authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id'

function isCorsPath(pathname: string) {
  return pathname === '/api/mcp'
    || pathname.startsWith('/oauth/')
    || pathname.startsWith('/.well-known/oauth-')
    || pathname === '/.well-known/openid-configuration'
}

export default defineEventHandler((event) => {
  const pathname = event.path.split('?')[0]
  if (!isCorsPath(pathname)) return

  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Methods', ALLOWED_METHODS)
  setHeader(event, 'Access-Control-Allow-Headers', ALLOWED_HEADERS)
  setHeader(event, 'Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id')
  setHeader(event, 'Access-Control-Max-Age', '600')
  // Only relevant if an allowlist ever replaces `*`; cheap to keep correct.
  setHeader(event, 'Vary', 'Origin')

  if (getMethod(event) === 'OPTIONS') {
    // Answer the preflight here so it never reaches a GET/POST-only route,
    // which would produce a 404 and fail the preflight.
    setResponseStatus(event, 204)
    return ''
  }
})
