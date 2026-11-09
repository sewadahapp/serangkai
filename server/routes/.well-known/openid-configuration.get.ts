/**
 * OIDC-style discovery alias.
 *
 * Some MCP clients try `/.well-known/openid-configuration` before (or instead
 * of) the RFC 8414 path. Serving the same document keeps discovery working
 * without pretending to be a full OpenID Provider.
 */
export { default } from './oauth-authorization-server.get'
