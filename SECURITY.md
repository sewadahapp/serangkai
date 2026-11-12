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
- Unlisted reads require an HMAC capability link. Downloading an unlisted
  artifact by opaque id alone is refused; the owner session or a valid `k` share
  key is required.
- Public share URLs resolve a globally unique slug (`artifacts_slug_unique`), so
  one account cannot shadow another account's artifact.
- API tokens are stored as SHA-256 hashes (Web Crypto, identical on Node and edge runtimes) and have scopes (`read`, `write`, `full`).
- MCP write tools require `write` or `full` scope.
- Minting a share capability URL is a write: a `read`-only token cannot create a
  new public or unlisted entry point.
- Minting or revoking API tokens requires a session or a `full`-scope token, so a leaked read/write token cannot escalate itself.
- Folder relationships are ownership-checked on create and update; artifacts and folders cannot be attached to another user's tree.
- Inline image/PDF previews are owner-only, served with `nosniff`, and images receive a sandbox CSP.
- Session resolution runs during SSR via request-forwarded cookies, so signed-in
  pages never flash logged-out chrome (or expose a different header) before hydration.

## Agent authorization (OAuth)

- MCP clients can authenticate with OAuth 2.1 instead of a pasted token.
  Serangkai is its own authorization server; discovery metadata is built from
  the request origin, so a self-hosted instance works at any deployment URL.
- The canonical origin is `PUBLIC_BASE_URL` when configured, otherwise the
  request origin. Set `PUBLIC_BASE_URL` when a reverse proxy rewrites `Host`;
  without it, the server trusts the incoming host for OAuth metadata and
  audience checks.
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
- Registration is bounded: JSON only, a 32 KiB body cap, at most ten redirect
  URIs of 2,048 characters each, bounded client metadata, and only the
  `none`/`client_secret_post` authentication methods the server can verify. An
  unsupported method is rejected rather than silently downgraded. Registration
  is rate-limited per client address.
- Every grant is bound to an RFC 8707 resource. An omitted `resource` defaults
  to the canonical `${origin}/api/mcp`; a supplied value must match that origin
  and path exactly, with no query, fragment, or embedded credentials. The check
  is applied at consent, code exchange, refresh, device authorization, device
  polling, and on every MCP request. Grants created before this binding existed
  are adopted on first refresh or first MCP use. Hand-minted API tokens have no
  grant row and remain usable as before.
- Consent is bound to the rendered request. The GET stores a random nonce and a
  fingerprint of the full request (client, redirect URI, PKCE challenge, scopes,
  state, resource, owner) in the sealed session; the POST must present the nonce
  and consume the state once. Up to eight pending pages are kept for multiple
  tabs. A bearer token cannot approve an OAuth client; consent requires a
  browser session.
- OAuth grants are capped at `read` and `write`. `full` is never grantable over
  OAuth, so a connected agent cannot mint or revoke API tokens or escalate.
  A request that names only unsupported scopes is refused, not widened into the
  default pair, and requested scopes are capped by what the client registered.
- Only the permissions the owner leaves checked are stored, even if the client
  asked for more. Unchecking every box is a denial, not a default grant.
- Access tokens live one hour. Refresh rotation is atomic: a conditional
  `UPDATE ... WHERE refresh_token_hash = ?` inside a SQLite transaction or a D1
  batch means exactly one concurrent request can win, even across instances;
  the loser's newly minted access token is deleted. A replayed refresh token
  fails. The grant id stays stable, so Settings still shows one connection.
  Revoking a grant deletes its access and refresh tokens together, including
  from Settings → Connected agents.
- Token and consent endpoints are rate-limited per client address. The limiter is
  per process, so on Cloudflare Workers it bounds a single isolate rather than
  the whole deployment; it raises the cost of a flood rather than guaranteeing a
  ceiling.
- CORS is enabled on the OAuth and MCP paths so browser-based clients work.
  `Access-Control-Allow-Origin: *` is never combined with
  `Access-Control-Allow-Credentials`, and MCP rejects cookie-only requests, so a
  cross-origin page gains nothing without already holding a bearer token.
- The device grant (RFC 8628) lets a headless client sign in without a callback
  port. Device codes are bound to the requesting client and resource, stored
  hashed, and single use. Approval and denial require a browser session **and**
  the same session-bound nonce as the consent screen, with a fingerprint over
  the stored request (device id, client, user code, displayed scopes, resource,
  owner); a forged cross-site POST cannot decide a grant, and a nonce cannot be
  retargeted to another code. Only checked scopes are stored, intersected with
  what was requested, so editing the form cannot widen the grant.
- Redeeming a device code is atomic: the conditional claim and both token rows
  are written in one SQLite transaction or D1 batch, and the claim links the
  winning API token to the device row so a concurrent loser removes its own
  inserts. A token-issuance failure rolls the claim back; the code stays
  redeemable instead of being consumed without credentials. Exactly one
  concurrent poll can win.
- Device decisions are conditional updates whose affected-row counts are
  checked: concurrent approve/approve, approve/deny, and deny/deny requests
  produce one winner, the other response reports the state that actually won,
  and expired or consumed requests cannot change state.
- Device verification is bounded: form-only parsing with an 8 KiB cap, a
  per-address rate limit on user-code lookup and decisions, at most 100 live
  device codes per client, and a ten-minute code lifetime. Device polling has
  its own per-address bucket sized for the advertised five-second interval;
  exceeding it answers `slow_down` as RFC 8628 expects. Bearer tokens cannot
  approve a device grant.
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
- Owner login is brute-force limited per process with a fixed window (ten
  failures per fifteen minutes by default, tunable with
  `SERANGKAI_LOGIN_RATE_LIMIT`/`SERANGKAI_LOGIN_RATE_WINDOW_MS`). Both JSON and
  native form posts are covered; a limited request gets the same generic failure
  as a wrong password, plus `Retry-After` for JSON. Unknown usernames run a
  dummy scrypt verification, so they cost the same as a wrong password and do
  not reveal whether the account exists. A successful login clears the bucket.
  The limiter is per process: a multi-instance deployment needs a durable
  counter to make the limit global.
- `X-Forwarded-For` is ignored by default because a caller can rotate it. It is
  honored only with `TRUST_PROXY=true` or when the socket peer is listed in
  `TRUSTED_PROXY_IPS`. This affects rate-limit buckets, never authorization.
  Without it, every client behind a proxy shares one bucket; the server logs a
  one-time warning when it sees the header on an untrusted socket.
- A browser that has signed in successfully gets a signed, HttpOnly
  `serangkai_device` cookie and is throttled on its own bucket, so failures on
  the shared address bucket cannot lock the owner out of a known browser. A
  new browser during an attack still waits for the window to expire. The
  cookie selects a rate-limit bucket only and grants no access.
- Browser sessions are sealed by Nuxt Auth Utils in an HttpOnly, SameSite=Lax
  cookie (`Secure` in production). The sealing key is derived from `JWT_SECRET`
  with HKDF-SHA256 and a versioned purpose, so no fifth secret is needed for
  Docker/Node deployments. Edge entry points set `NUXT_APP_SECRET` explicitly.
- Logout clears the cookie. Because the session is sealed rather than stored in
  a database, a copied cookie remains valid until it expires or until
  `JWT_SECRET` (and therefore the derived session key) is rotated.
- REST and MCP bearer tokens are separate from browser sessions. Any request
  that sends an `Authorization` header is treated as an agent request: the
  `Bearer` scheme is parsed case-insensitively, and a malformed, invalid, or
  expired credential never falls back to the owner's cookie. MCP rejects a
  cookie-only request.
- The owner identity is stable across restarts. Changing `ADMIN_USERNAME` or
  `ADMIN_PASSWORD` rotates credentials in place without creating or deleting a
  user. Changing `JWT_SECRET` signs every browser out; changing `SHARE_SECRET`
  invalidates signed unlisted links.
- A database with multiple users is not merged automatically. Startup fails with
  instructions; `SERANGKAI_MIGRATION_OWNER_USER_ID` selects one account, and
  the other accounts keep their rows but lose authentication (username cleared).

## Storage durability

On Cloudflare, a missing or misconfigured R2 binding fails startup instead of
silently mounting an in-memory driver. `STORAGE_DRIVER=s3` selects an external
S3-compatible provider (such as Backblaze B2) instead of R2; the adapter signs
every request with SigV4 and a signed payload hash, treats only missing-object
reads as `null`, and fails loudly on failed writes. Its configuration is
validated when the driver mounts — an endpoint without a scheme, an invalid
bucket name, or missing credentials is reported with an actionable message
naming the variable — and the bucket is probed on first storage use (Workers
forbid network I/O during plugin initialization). Every failure path mounts a
driver whose operations throw rather than leaving the mount empty: Nitro
swallows plugin errors on Workers, and an empty mount would let unstorage's
in-memory default absorb uploads silently. A 404 on a write is never treated as
success, and S3 has no memory fallback.
`SERANGKAI_ALLOW_EPHEMERAL_STORAGE=true` is honored only outside production and
only for tests/local previews — never as a production fallback.

The Docker image keeps SQLite, uploads, and versions under `/data`. The
entrypoint refuses to start when the configured paths are missing or read-only.
Running without a persistent volume is supported only as a non-durable smoke
test.

## Database initialization

On Cloudflare, D1 schema setup is guarded by a shared per-isolate promise, so
concurrent requests wait for the same migration rather than observing a
half-created schema. A failed initialization clears the promise and is retried
by the next request instead of permanently serving an uninitialized database.
The additive OAuth migration creates the grant tables and the RFC 8707
`resource` column on pre-existing databases; it never rewrites or deletes rows.

## Verified negative cases

The automated security tests cover restrictive HTML CSP headers, unauthenticated
upload denial, private delivery checks, invalid unlisted links, unlisted
downloads without a capability key, read-only share minting, executable Markdown
links, HTML metadata escaping, script execution through image MIME metadata and
bundle SVG/uppercase HTML assets, unsafe URL schemes and CSS-bearing nested
component data, cross-account share-slug collisions, malformed and expired
bearer tokens that must not fall back to a session, login throttling and
`X-Forwarded-For` spoofing, concurrent refresh rotation, audience mismatches,
consent POSTs without a rendered session-bound nonce, oversized or non-JSON
registration bodies, unsupported client auth methods, and concurrent D1
initialization. Device-flow coverage adds forged approval and denial POSTs,
retargeted and evicted consent nonces, scope widening, bounded bodies, repeated
user-code guesses, excessive polling, concurrent redemption, failure-injection
rollback (claim rollback on token-issuance failure), concurrent approve/deny
races, and expired or consumed decisions. Storage coverage verifies B2-style
SigV4 signing, binary integrity, prefix listing, loud write failures, and
D1 + B2 persistence across a Worker restart. Public exposure still merits an
independent security review before treating the product as hardened.
