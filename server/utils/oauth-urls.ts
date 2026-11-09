import { getRequestURL } from 'h3'
import { getServerConfig } from './config'

/**
 * The absolute origin this installation is reachable at.
 *
 * OAuth has no way to discover the deployment URL: the client only knows the
 * MCP URL the user typed in. Every well-known document and redirect is derived
 * from that request, which is exactly what a self-hosted instance needs.
 *
 * `PUBLIC_BASE_URL` is the override for deployments behind a proxy that
 * rewrites `Host` (the same setting share links already respect). Request
 * headers such as `X-Forwarded-Host` are honored by `getRequestURL`, so a
 * normal reverse proxy needs no configuration.
 */
export function requestOrigin(event: unknown): string {
  const configured = getServerConfig().publicBaseUrl
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // A malformed value should not take the server down; the request origin
      // is the safer fallback.
    }
  }
  return getRequestURL(event as any).origin
}

/** Absolute, path-less issuer identifier (RFC 8414 requires no query/fragment). */
export function issuerUrl(event: unknown): URL {
  return new URL(requestOrigin(event))
}

/** The MCP resource identifier, used for RFC 8707 `resource` binding. */
export function mcpResourceUrl(event: unknown): URL {
  return new URL('/api/mcp', requestOrigin(event))
}

/** Absolute URL for a path on this installation. */
export function absoluteUrl(event: unknown, path: string): URL {
  return new URL(path, requestOrigin(event))
}

/**
 * RFC 9728 protected-resource metadata is advertised at the resource's own path:
 * `/.well-known/oauth-protected-resource/api/mcp`.
 */
export function protectedResourceMetadataUrl(event: unknown): URL {
  return new URL('/.well-known/oauth-protected-resource/api/mcp', requestOrigin(event))
}
