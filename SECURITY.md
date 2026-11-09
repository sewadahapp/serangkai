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

## Agent authorization (OAuth)

- MCP clients can authenticate with OAuth 2.1 instead of a pasted token.
  Serangkai is its own authorization server; discovery metadata is built from
  the request origin, so a self-hosted instance works at any deployment URL.
- Authorization codes are stored as SHA-256 hashes, never in plaintext. They are
  single-use (a conditional `UPDATE ... WHERE consumed_at IS NULL`), expire after
  five minutes, and are bound to the client, the exact redirect URI, and the
  PKCE challenge.
- PKCE `S256` is required. The implicit flow and the `plain` challenge method do
  not exist, so an intercepted code is useless without the verifier.
- Redirect URIs are matched exactly, with only the RFC 8252 §7.3 loopback-port
  exception for native clients. A mismatched URI is answered with an error page,
  never a redirect, because redirecting to an unvalidated URI is the attack this
  endpoint must not enable.
- Dynamic client registration is open by necessity (MCP clients self-register),
  but registration alone grants nothing. A client cannot act until the owner
  approves it on the consent screen, which requires the browser session.
- OAuth grants are capped at `read` and `write`. `full` is never grantable over
  OAuth, so a connected agent cannot mint or revoke API tokens or escalate.
- Only the permissions the owner leaves checked are stored, even if the client
  asked for more. Unchecking every box is a denial, not a default grant.
- Access tokens live one hour; refresh tokens rotate on every use, so a replayed
  refresh token fails. Revoking a grant deletes its access and refresh tokens
  together, including from Settings → Connected agents.
- Token and consent endpoints are rate-limited per client address. The limiter is
  per process, so on Cloudflare Workers it bounds a single isolate rather than
  the whole deployment; it raises the cost of a flood rather than guaranteeing a
  ceiling.
- CORS is enabled on the OAuth and MCP paths so browser-based clients work.
  `Access-Control-Allow-Origin: *` is never combined with
  `Access-Control-Allow-Credentials`, and MCP rejects cookie-only requests, so a
  cross-origin page gains nothing without already holding a bearer token.
- The device grant (RFC 8628) lets a headless client sign in without a callback
  port. Device codes are stored hashed and single use; the short user code is
  accepted only while pending, within its ten-minute lifetime, and approval
  still requires the owner's session. Polling an undecided code returns
  `authorization_pending`, never a token.
- Credential management (`/api/tokens`, `/api/oauth/clients`) is session-only. A
  bearer token can never list, mint, or revoke credentials — including an OAuth
  grant trying to enumerate or disconnect its siblings.
- MCP clients require HTTPS except on loopback, so a plain-HTTP LAN deployment
  will be refused by the client. That is a client-side requirement, not a server
  control.

## Authentication and accounts

- Serangkai has exactly one owner account, configured with `ADMIN_USERNAME` and
  `ADMIN_PASSWORD`. There is no registration API or page.
- Passwords are hashed with Nuxt Auth Utils' scrypt helper; plaintext is never
  stored. Existing bcrypt hashes are replaced with a scrypt hash on the first
  startup after the upgrade, using the configured `ADMIN_PASSWORD`.
- Browser sessions are sealed by Nuxt Auth Utils in an HttpOnly, SameSite=Lax
  cookie (`Secure` in production). The sealing key is derived from `JWT_SECRET`
  with HKDF-SHA256 and a versioned purpose, so no fifth secret is needed for
  Docker/Node deployments. Edge entry points set `NUXT_APP_SECRET` explicitly.
- Logout clears the cookie. Because the session is sealed rather than stored in
  a database, a copied cookie remains valid until it expires or until
  `JWT_SECRET` (and therefore the derived session key) is rotated.
- REST and MCP bearer tokens are separate from browser sessions. A request that
  sends an `Authorization: Bearer` header is validated as a token and never
  falls back to the owner's cookie; MCP rejects a cookie-only request.
- The owner identity is stable across restarts. Changing `ADMIN_USERNAME` or
  `ADMIN_PASSWORD` rotates credentials in place without creating or deleting a
  user. Changing `JWT_SECRET` signs every browser out; changing `SHARE_SECRET`
  invalidates signed unlisted links.
- A database with multiple users is not merged automatically. Startup fails with
  instructions; `SERANGKAI_MIGRATION_OWNER_USER_ID` selects one account, and
  the other accounts keep their rows but lose authentication (username cleared).

## Storage durability

On Cloudflare, a missing or misconfigured R2 binding fails startup instead of
silently mounting an in-memory driver. `SERANGKAI_ALLOW_EPHEMERAL_STORAGE=true`
is honored only outside production and only for tests/local previews.

The Docker image keeps SQLite, uploads, and versions under `/data`. The
entrypoint refuses to start when the configured paths are missing or read-only.
Running without a persistent volume is supported only as a non-durable smoke
test.

## Verified negative cases

The automated security tests cover restrictive HTML CSP headers, unauthenticated
upload denial, private delivery checks, invalid unlisted links, executable
Markdown links, HTML metadata escaping, script execution through image MIME
metadata and bundle SVG/uppercase HTML assets, unsafe URL schemes and
CSS-bearing nested component data, and cross-account share-slug collisions.
Public exposure still merits an independent security review before treating the
product as hardened.
