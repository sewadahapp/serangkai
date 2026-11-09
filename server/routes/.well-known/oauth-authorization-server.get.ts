import { absoluteUrl } from '../../utils/oauth-urls'
import { OAUTH_SCOPES } from '../../utils/oauth'

/**
 * RFC 8414 Authorization Server Metadata (also aliased at
 * `/.well-known/openid-configuration` by the OIDC-style fallback route).
 *
 * Endpoints are absolute and derived from the request origin, so the same build
 * works at any deployment URL without configuration.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return {
    issuer: absoluteUrl(event, '/').href.replace(/\/$/, ''),
    authorization_endpoint: absoluteUrl(event, '/oauth/authorize').href,
    token_endpoint: absoluteUrl(event, '/oauth/token').href,
    registration_endpoint: absoluteUrl(event, '/oauth/register').href,
    revocation_endpoint: absoluteUrl(event, '/oauth/revoke').href,
    scopes_supported: [...OAUTH_SCOPES],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // MCP clients are public clients using PKCE, so no client secret is
    // required at the token endpoint. `client_secret_post` stays available for
    // confidential clients that prefer it.
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    service_documentation: absoluteUrl(event, '/agent').href,
  }
})
