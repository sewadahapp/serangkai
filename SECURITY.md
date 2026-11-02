# Security model

## Current isolation boundary

Serangkai treats uploaded HTML and JavaScript as untrusted content. Public HTML
responses include a restrictive Content Security Policy with `sandbox
allow-scripts`, `connect-src 'none'`, and `frame-ancestors 'none'`. The sandbox
does not grant same-origin access, forms, popups, or network access. Public
Markdown is rendered through `marked` and sanitized with `sanitize-html`.

This is defense-in-depth, not a claim that arbitrary active web content is safe
on the same deployment origin under every browser or proxy configuration.
Production deployments should place artifact delivery behind a separate origin
when publishing untrusted applications. Serangkai does not execute uploaded
code on the server and does not run build jobs for uploaded bundles.

## Authorization

- Artifacts are private by default.
- Private reads require the owning session or an authenticated owner token.
- Unlisted reads require an HMAC capability link.
- API tokens are stored as SHA-256 hashes (Web Crypto, identical on Node and edge runtimes) and have scopes (`read`, `write`, `full`).
- MCP write tools require `write` or `full` scope.
- Minting or revoking API tokens requires a session or a `full`-scope token, so a leaked read/write token cannot escalate itself.

## Verified negative cases

The automated security tests cover restrictive HTML CSP headers, unauthenticated
upload denial, private delivery checks, invalid unlisted links, executable
Markdown links, and HTML metadata escaping. Public exposure still requires an
independent security review before treating the product as hardened.
