# Security model

## Current isolation boundary

Serangkai treats uploaded HTML, JavaScript, SVG, and bundled applications as
untrusted content.

- Public HTML artifact responses use a restrictive Content Security Policy:
  `sandbox allow-scripts`, `connect-src 'none'`, `form-action 'none'`, and a
  same-origin `frame-ancestors` allowance so the reader can frame the document.
  The sandbox grants no same-origin access, forms, or popups, and no network.
- Bundle assets that resolve to `text/html` or `image/svg+xml` receive the same
  sandbox policy, independent of filename casing.
- Image artifacts are always served with a sandbox CSP and `nosniff`; an
  author-supplied `metadata.mimeType` is honored only when it is an `image/*`
  type, so it cannot upgrade an artifact into an executable document.
- Markdown is parsed once on the server with Comark, sanitized, and transformed
  into a small trusted vocabulary rendered by `MarkdownDocument`. Author
  expressions, event handlers, styles, unknown components, and unsafe URL
  schemes are removed before the renderer sees the document. Nested component
  data is sanitized recursively; the registry is the only path to a Selaras
  component.

This is defense-in-depth, not a claim that arbitrary active web content is safe
on the same deployment origin under every browser or proxy configuration.
Production deployments should place artifact delivery behind a separate origin
when publishing untrusted applications. Serangkai does not execute uploaded code
on the server and does not run build jobs for uploaded bundles.

## Authorization

- Artifacts are private by default.
- Private reads require the owning session or an authenticated owner token.
- Unlisted reads require an HMAC capability link.
- Public share URLs resolve a globally unique slug (`artifacts_slug_unique`), so
  one account cannot shadow another account's artifact.
- API tokens are stored as SHA-256 hashes (Web Crypto, identical on Node and edge runtimes) and have scopes (`read`, `write`, `full`).
- MCP write tools require `write` or `full` scope.
- Minting or revoking API tokens requires a session or a `full`-scope token, so a leaked read/write token cannot escalate itself.
- Folder relationships are ownership-checked on create and update; artifacts and folders cannot be attached to another user's tree.
- Inline image/PDF previews are owner-only, served with `nosniff`, and images receive a sandbox CSP.
- Session resolution runs during SSR via request-forwarded cookies, so signed-in
  pages never flash logged-out chrome (or expose a different header) before hydration.

## Storage durability

On Cloudflare, a missing or misconfigured R2 binding fails startup instead of
silently mounting an in-memory driver. `SERANGKAI_ALLOW_EPHEMERAL_STORAGE=true`
is honored only outside production and only for tests/local previews.

## Verified negative cases

The automated security tests cover restrictive HTML CSP headers, unauthenticated
upload denial, private delivery checks, invalid unlisted links, executable
Markdown links, HTML metadata escaping, script execution through image MIME
metadata and bundle SVG/uppercase HTML assets, unsafe URL schemes and
CSS-bearing nested component data, and cross-account share-slug collisions.
Public exposure still merits an independent security review before treating the
product as hardened.
