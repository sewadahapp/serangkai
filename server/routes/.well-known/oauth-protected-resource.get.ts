import { absoluteUrl } from '../../utils/oauth-urls'
import { OAUTH_SCOPES } from '../../utils/oauth'

/**
 * RFC 9728 OAuth 2.0 Protected Resource Metadata.
 *
 * This is the first document an MCP client fetches after a 401. It names the
 * authorization server — here, this same installation — so the client can find
 * the rest of the endpoints without the user configuring anything.
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
