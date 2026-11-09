import { absoluteUrl } from '../../../../utils/oauth-urls'
import { OAUTH_SCOPES } from '../../../../utils/oauth'

/**
 * Path-scoped RFC 9728 metadata.
 *
 * The spec puts protected-resource metadata under the resource's own path, so
 * `/.well-known/oauth-protected-resource/api/mcp` is the canonical location and
 * the first URL an MCP client probes. The root document is kept as a fallback
 * for clients that only try the origin.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return {
    resource: absoluteUrl(event, '/api/mcp').href,
    authorization_servers: [absoluteUrl(event, '/').href],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Serangkai',
    resource_documentation: absoluteUrl(event, '/agent').href,
  }
})
