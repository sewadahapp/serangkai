# Serangkai Architecture

## Overview
Serangkai is a Nuxt 4 application providing artifact storage, organization, and sharing for AI agents and humans.

## Technology Stack
- **Frontend/Framework**: Nuxt 4, Vue 3, TypeScript
- **UI Components**: @sewadah/selaras — 13 components in use (`SApp`, `SSelect`,
  `SFormField`, `SFileUpload`, `SCheckbox`, `SAlertDialog` via `useConfirm`,
  `SToast` via `useToast`, and others). `app.vue` mounts `SApp` once, which is
  required for `useToast`/`useConfirm`/`useModal` renderers to exist.
- **Source editor**: CodeMirror 6 (`codemirror` plus the HTML, Markdown, JSON, and
  JavaScript language packages), MIT licensed. It is a lazy, client-only chunk
  (~208 KB gzip for all four languages), so readers and workspace browsers never
  download it. Monaco was rejected at ~1.7 MB gzip once CSS and workers are
  counted; Tiptap/Lexical/Quill are rich-text editors and normalize the HTML
  instead of editing raw source. `vue-codemirror` is unmaintained and is not used.
- **Local MCP dogfooding**: `bun run dev` is pinned to `127.0.0.1:6969`.
  `opencode.json` registers a `serangkai` MCP server that runs
  `scripts/serangkai-mcp.sh`, a stdio→HTTP bridge reading the bearer token from
  the gitignored `.env.serangkai-mcp`. See `docs/development/mcp-dogfood.md`.
- **Agent support**: the `selaras` skill (copied from the installed package into
  `.opencode/skills/`) and the local `@sewadah/selaras-mcp` stdio server, wired in
  `opencode.json`, serving the offline catalog that ships inside
  `@sewadah/selaras`.
- **Design system**: Minimalism & Swiss Style — trust blue `#2563EB` primary with an
  `#EA580C` accent, Plus Jakarta Sans, light mode by default with a dark mode toggle.
  Generated with the `ui-ux-pro-max` skill (variance 3 / motion 3 / density 5) and
  wired through `selaras.theme.colors` in `nuxt.config.ts`.
- **Content**: Comark (`comark` + `@comark/vue`) for Markdown parsing and component-driven rendering
- **Charts/Diagrams**: Mermaid, rendered theme-aware, and TanStack Charts through
  a JSON bar/line/area schema in Markdown and sandboxed HTML artifacts.
  Author-supplied JavaScript is never evaluated.
- **Backend**: Nuxt Nitro server routes (Nitro 2 / H3 v1 via Nuxt 4)
- **Database**: Drizzle ORM with Bun's built-in SQLite under Bun, better-sqlite3
  under Node, and a request-scoped D1 adapter for Cloudflare
- **Storage**: Nitro `useStorage()` over unstorage — filesystem by default,
  Cloudflare R2 binding, or S3-compatible storage
- **Toolchain**: Bun 1.4 for install, scripts, tests, builds, and the Docker
  runtime; Node 24 remains an explicit fallback for Vercel/Node deployments
- **Auth**: Nuxt Auth Utils sealed browser sessions + scoped API tokens; one
  environment-configured owner account (no public registration)
- **MCP**: Official `@modelcontextprotocol/sdk` Streamable HTTP transport

## System Design

### Data Model
```typescript
User {
  id: string
  email: string // internal, preserved for legacy rows
  username: string | null // owner login name; null for migrated-away accounts
  passwordHash: string // auth-utils scrypt hash
  createdAt: Date
  updatedAt: Date
}

ApiToken {
  id: string
  userId: string
  name: string
  tokenHash: string (store hash only)
  scopes: string[] // ['read', 'write', 'publish']
  lastUsedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

Folder {
  id: string
  userId: string
  parentId: string | null
  name: string
  path: string // computed path for quick lookup
  createdAt: Date
  updatedAt: Date
}

Artifact {
  id: string
  userId: string
  folderId: string | null
  slug: string // globally unique public identifier (unique index)
  title: string
  type: 'markdown' | 'html' | 'javascript' | 'pdf' | 'image' | 'json' | 'bundle'
  visibility: 'private' | 'public' | 'unlisted'
  contentPath: string // path to file in storage
  metadata: JSON
  createdAt: Date
  updatedAt: Date
}

ArtifactVersion {
  id: string
  artifactId: string
  version: number
  contentPath: string
  metadata: JSON
  createdAt: Date
}
```

### Storage Layer
Artifact bytes use Nitro's built-in storage abstraction (`useStorage()` over
unstorage). Keys are the existing `userId/artifactId/...` paths, so the local
filesystem layout and all existing artifacts remain compatible.

- Local/Docker: `fs` driver mounted at `STORAGE_PATH` (default `./data/files`)
- Cloudflare: `cloudflare-r2-binding` driver mounted at `R2_BINDING`
  (default `ARTIFACTS`)
- Vercel/portable: `s3` driver when `STORAGE_DRIVER=s3`
- Static bundles are extracted into the same store under
  `userId/artifactId/bundle/...`; no route reads the filesystem directly.

`server/plugins/storage.ts` mounts the driver once at startup, and
`server/utils/artifact-storage.ts` is the single read/write surface. On
Cloudflare, a missing R2 binding fails startup rather than mounting an in-memory
driver; `SERANGKAI_ALLOW_EPHEMERAL_STORAGE=true` (non-production only) exists
solely for tests and local previews.

### API Routes (Nitro)
- `POST /api/auth/login` - Owner login (username + password)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user (session or bearer token)
- `GET|DELETE /api/_auth/session` - Nuxt Auth Utils session state
- `POST /api/tokens` - Create API token
- `GET /api/tokens` - List tokens
- `DELETE /api/tokens/:id` - Revoke token
- `GET /api/folders` - List folders
- `POST /api/folders` - Create folder
- `PUT /api/folders/:id` - Rename or move a folder, rejecting cycles and rewriting descendant paths
- `DELETE /api/folders/:id` - Delete an empty folder
- `GET /api/artifacts` - List artifacts (with filters)
- `POST /api/artifacts` - Create artifact
- `POST /api/artifacts/upload` - Multipart upload (Markdown, HTML, JSON, PDF, images, ZIP bundles)
- `GET /api/artifacts/:id` - Get artifact
- `PUT /api/artifacts/:id` - Update artifact, including visibility and folder.
  Content changes require `baseVersion`; a missing value is `400` and a stale
  one is `409` with `data.currentVersion`. The web editor sends the loaded
  version and reloads on conflict.
- `DELETE /api/artifacts/:id` - Delete artifact
- `GET /api/artifacts/:id/versions` - Version history
- `GET /api/artifacts/:id/versions/:version` - Read a historical version
- `POST /api/artifacts/:id/versions/:version/restore` - Restore a version as a new version
- `GET /api/artifacts/:id/download` - Download the original source
- `GET /api/artifacts/:id/preview` - Owner-only inline image/PDF preview
- `POST /api/artifacts/:id/duplicate` - Copy an artifact as a new private artifact
- `POST /api/artifacts/:id/share` - Build a public or signed unlisted share URL
- `GET /api/share/:slug` - Public/unlisted artifact delivery. Markdown redirects
  to the `/share/:slug` reader; `?format=json` returns its rendered data.
- `GET /api/share/:slug/*` - Scoped static bundle asset delivery
- `GET /api/search` - Search artifacts/folders, optionally scoped to a folder subtree
- `GET /api/overview` - Workspace summary: counts, visibility, storage total, recent artifacts
- `GET /api/oauth/clients` - List approved OAuth grants (browser session only)
- `DELETE /api/oauth/clients/:id` - Disconnect a grant and delete its access token
- `GET /api/health` - Health check

### OAuth endpoints (Nitro, outside `/api`)
- `GET /.well-known/oauth-protected-resource[/api/mcp]` - RFC 9728 metadata
- `GET /.well-known/oauth-authorization-server` - RFC 8414 metadata
- `GET /.well-known/openid-configuration` - OIDC-style alias of the same document
- `GET|POST /oauth/authorize` - Consent page and approval decision
- `POST /oauth/register` - RFC 7591 dynamic client registration (rate-limited)
- `POST /oauth/token` - Authorization code exchange and refresh rotation
- `POST /oauth/revoke` - RFC 7009 revocation

### MCP Integration
MCP server at `/api/mcp` (Streamable HTTP) providing tools:
- `list_folders` - List folders
- `search` - Search artifacts and folders, optionally scoped to a folder subtree
- `create_folder` - Create a folder, optionally nested
- `list_artifacts` - List user's artifacts
- `get_artifact` - Read artifact content
- `create_artifact` - Create new artifact, optionally inside a folder
- `update_artifact` - Publish content, visibility, or folder changes.
  `baseVersion` (the version read with `get_artifact`) is **required whenever
  content changes**; a mismatch is refused with the current version so the agent
  can re-read and merge, the same stale-write guard Claude Code applies.
  Metadata-only updates are exempt, and unchanged content creates no version.
  Mutating tools declare `destructiveHint`.

### Frontend Routes
- `/` - Landing page with capability, agent-setup, and CTA sections. The only
  indexable page (`index, follow` plus canonical and Open Graph tags).
- `/auth/login` - Owner login with labeled `SFormField` inputs; registration does not exist
- `/dashboard` - Workspace overview: counts, storage total, recent activity, types
- `/workspace` - Artifact workspace with folder tree, scoped search, create/upload panels
- `/artifacts/[id]` - Artifact preview/edit. The artifact is fetched during SSR so
  the title renders on a direct load and a missing artifact answers 404; history,
  folders, and the share link load after the document. Markdown, HTML, JSON, and
  JavaScript open a full-viewport source workspace with an inline title, type and
  version, dirty state, and Save/Cancel; preview mode keeps the sharing, folder,
  and version panels. HTML previews size to the document and scroll with the page,
  with `70vh` as the floor; Markdown already renders in-page. PDFs keep the
  browser's viewer and fill the content column.
- `/settings` - API token creation, listing, and revocation
- `/agent` - MCP/REST connection guide with endpoint, client config, scope reference,
  publishing workflow (`baseVersion`), the HTML color-mode contract, and the
  Mermaid/chart marker syntax
- `/share/[slug]` - Public reader for every shared artifact type. Only the
  Serangkai header is sticky; the footer is shared by every type but follows
  the content in normal flow. Markdown gets the workspace prose styles, Shiki,
  Mermaid, charts, and a contents rail; images sit in a document page. HTML,
  bundles, PDFs, and JSON/JavaScript skip the title card and use the full
  width: framed types are borderless and sandboxed (with the live color mode
  posted into them), PDFs use the browser viewer, and source files get a
  full-width highlighted code block. It has no workspace navigation and is
  `noindex`. Signed unlisted links pass `?k=`.
- Share delivery happens through `/api/share/:slug`, which applies visibility,
  always redirects Markdown to the reader, and redirects other types only for
  top-level browser navigations (`Sec-Fetch-Dest: document`). Frames, images,
  and direct fetches still receive raw bytes, so the reader can embed them
  without redirecting to itself. HTML artifacts allow `frame-ancestors 'self'`
  for that frame; the sandbox still denies same-origin access.

### Design system notes
- Semantic roles (`primary`, `accent`, plus Selaras builtins) are compiled at build
  time; components reference `var(--selaras-resolved-*)` tokens rather than raw hex.
- Site identity lives in `shared/site.ts` and ships from `nuxt.config.ts`'s
  `app.head`: `titleTemplate: '%s · Serangkai'` (a string, because Nuxt
  serializes `app.head` with `JSON.stringify`, which drops functions), the
  description, Open Graph basics, `noindex` by default, and the icon links.
  Pages set only their short title. The landing page is the sole exception: it
  sets the full product title with `titleTemplate: null`, opts into indexing,
  and adds a request-derived canonical URL. The icon set is a rounded mark for
  browser tabs (`favicon.ico` at 16/32/48, `favicon.svg`) and full-bleed
  install icons (`apple-touch-icon.png`, `icon-192/512.png`, plus a maskable
  variant) described by `public/site.webmanifest`.
- `app/assets/css/main.css` holds the font face, shell width, prose measure, skip
  link, and a global `prefers-reduced-motion` override.
- All form controls live inside `SFormField` so labels, hints, and errors are
  programmatically associated. `SLabel` does not exist in Selaras.
- Markdown is parsed with Comark into a serializable document on the server.
  A custom post-pass restricts it to a trusted vocabulary, strips author
  expressions/bindings/styles, and turns `mermaid`/`chart` fences into trusted
  component nodes. The reader renders that document with `MarkdownDocument`, so
  Mermaid, charts, and approved Selaras components are real Vue components — no
  `v-html` and no manual `createApp().mount()` DOM pass.
- Markdown code fences are highlighted with Comark's Shiki plugin using
  `github-light` / `github-dark` dual themes emitted as `--shiki-light` /
  `--shiki-dark` custom properties. `MarkdownPre` wraps the highlighted tree in
  Selaras `SProsePre`, which provides the language header and copy button.
  Unknown languages fall back to plain text.
- Markdown headings get stable, unique ids from the MDC parser (`setup`,
  `setup-2`, ...) so headings can be deep-linked. The share reader builds an
  `SContentToc` rail from the parser's TOC links; the in-app preview
  deliberately has no contents panel, keeping the focus on the document and
  the sharing controls.
- Markdown `chart` fences accept JSON — `type` (`bar`, `line`, `area`), `data`,
  optional `x`/`y` keys, `title`, axis labels, `horizontal`, `color`, and
  `height`. `DataChart.client.vue` maps that onto fixed TanStack Charts marks and
  compact scales. The schema exists because chart definitions need functions,
  which JSON cannot carry; evaluating author JavaScript instead would break the
  artifact security model. Invalid or empty definitions fall back to the raw
  JSON rather than a blank panel.
- Mermaid diagrams re-render when the color mode changes: `MermaidDiagram` uses
  `theme: 'neutral'` in light mode and `'dark'` in dark mode, observing the
  `class` attribute on `<html>`. Mermaid and chart components are wrapped in
  `ClientOnly`, so SSR sends readable fallback text and the browser hydrates the
  interactive diagram.
- Approved declarative and restricted-local-state Selaras components are
  defined in `shared/artifact-components.ts`, which is the single source of
  truth for renderer mappings, prop validation, MCP discovery, and authoring
  documentation. Forms, overlays, dashboard shells, and other application-state
  components are explicitly application-only. `get_artifact_capabilities`,
  resources, and prompts derive from this registry.
- HTML artifacts remain self-styled by default. `<meta name="serangkai-theme"
  content="selaras-document">` opts into a locally served stylesheet generated
  from Selaras prose CSS; the link is injected only when that meta tag is
  present. The theme provides typography and colors, not Vue components.
- App-owned snippets (MCP config, curl examples, shell workflows) use
  `SerangkaiCode`, which wraps the real `SProsePre` so the header and copy
  button are the component's, and fetches only the highlighted body from
  `POST /api/highlight`. JSON and JavaScript artifact previews use it too, so
  uploaded source files read like code rather than plain text. That endpoint returns Shiki spans sanitized down to
  `pre`/`code`/`span`, or escaped text for unknown languages, and rejects
  snippets above 50,000 characters so the public route cannot be used to burn
  unbounded CPU. The landing page's hero request and MCP config use it too,
  with `language="http"` and `language="json"` respectively.
- `#selaras/tailwind.css` is imported in the Tailwind entry as the installation
  guide requires; it defines `--selaras-adaptive-breakpoint`, without which
  adaptive presentation warns and silently disables.
- HTML artifacts follow the viewer's color mode. `server/utils/artifact-color-mode.ts`
  injects a small `color-scheme` + postMessage bridge; the in-app preview posts the
  live mode so artifacts re-theme without a reload, while public share links bake the
  mode in from `Sec-CH-Prefers-Color-Scheme` and then follow `prefers-color-scheme`.
  Artifacts can opt out with `<meta name="color-scheme" content="only light">`.
  `sandbox allow-scripts` still denies same-origin access, forms, popups, framing,
  and network calls.
- The authenticated HTML preview also injects a height reporter
  (`server/utils/artifact-preview-height.ts`). Because the sandboxed frame is
  opaque-origin, the parent listens for a source-checked `serangkai:height`
  message and resizes the frame to the document height, so document-style
  artifacts scroll with the page. Reports that equal the current frame height
  are ignored, which keeps `100vh` artifacts from growing in a feedback loop.
  Public share delivery does not inject the reporter.
- Sandboxed HTML artifacts can render Mermaid and TanStack charts without a CDN
  by opting into a same-origin runtime. `server/utils/artifact-runtime.ts` scans
  the delivered HTML and injects only the bundles it needs:
  `/runtime/charts.js` for `[data-serangkai-chart]` and `/runtime/mermaid.js`
  for `.mermaid` / `[data-serangkai-mermaid]`. Chart definitions are JSON
  (`<script type="application/json" data-serangkai-chart>` or a data attribute),
  and Mermaid source stays declarative, so the runtime never evaluates artifact
  JavaScript. Both bundles are built by `scripts/build-artifact-runtime.mjs`
  into gitignored `public/runtime/` before dev/build. They are classic IIFEs,
  not modules: a sandboxed frame has an opaque origin, and module imports would
  require CORS. `charts.js` is ~186 KB raw / 67 KB gzip; `mermaid.js` is
  ~5.3 MB raw / 1.5 MB gzip and only loads when a diagram is present.
- The owner preview and public HTML share CSP allow `script-src 'self'` in
  addition to the inline bridge, so the runtime can load. `connect-src 'none'`
  still prevents network calls, and the runtime itself only reads declarative
  markers. Nuxt Auth Utils resolves the sealed session on every page, including
  the public reader, so navigation between a share link and the app keeps the
  correct signed-in state.
- Source editing uses CodeMirror 6 directly rather than a wrapper component.
  `SerangkaiEditor.client.vue` owns the editor view, language compartment, a
  Selaras-token theme (so light/dark needs no foreign theme), JSON parse linting,
  Markdown line wrapping, and `Mod-S`. `SerangkaiCodeEditor.vue` adds the file
  tab, dirty dot, fullscreen toggle, and Ln/Col/lines/chars/UTF-8 status bar.
  The editor is lazy-loaded: previews, share pages, and the workspace list do
  not pay for it. HTML gets tag/attribute autocomplete and auto-closing tags;
  JSON gets inline parse errors before saving.
- Read-only values people copy (MCP/REST endpoints, signed share links, a
  freshly minted API token) put `SerangkaiCopyButton` in `SInput`'s `trailing`
  slot. It uses `copyText`, which falls back to a temporary textarea when the
  instance is served over plain HTTP and `navigator.clipboard` is unavailable,
  and swaps to a check mark for 1.5s instead of raising a toast.
- There are no native form elements left in app forms: text inputs use `SInput`,
  choices use `SSelect`, booleans use `SCheckbox`, files use `SFileUpload`, and
  dates use `SDatePicker` with `@internationalized/date` `DateValue`s. Multi-line
  source editing uses CodeMirror 6 instead of `STextarea`.
- The global `:focus-visible` outline targets links and custom tabbables only.
  Form controls are excluded because Selaras draws its own focus ring, and an
  extra outline stacked a second ring on every focused field.

### Error handling and recovery
- `app/error.vue` is the full-page fallback for fatal and SSR errors and for
  artifact 401/403/404 responses. Because it replaces `app.vue`, it includes its
  own `SApp`, header, footer, and color-mode toggle. Its illustration is an
  inline, themable SVG, so the page has no external asset dependency.
- Recoverable page-load failures stay inside the app shell through
  `SerangkaiErrorState`, with a retry action: workspace folders/artifacts, the
  overview, API-token loading, and artifact loading all use it. Secondary
  artifact requests (history and folder names) use `Promise.allSettled`, so
  their failure cannot blank an artifact that already loaded.
- `SerangkaiErrorHero` is shared by the full-page error screen and the public
  share reader, so a missing or private share uses the same illustration,
  typography, status code, and recovery actions while keeping the reader's own
  header and footer.
- The default layout, the full-page error screen, and the share reader are flex
  columns with `min-h-dvh`; their footer sits at the viewport bottom when the
  content is shorter than the screen.
- `NuxtErrorBoundary` wraps `NuxtPage`. A component failure keeps the layout and
  navigation available, and `router.afterEach` clears the boundary when the
  route changes so the fallback cannot cover the next page. The fallback's retry
  remounts the page; 404/401/403 from artifact loading use `showError` instead.
- Non-HTML clients still receive Nuxt's JSON error response. Production pages
  never render a stack trace; development only shows details behind a collapsed
  section on the error page.

### Authentication
- Nuxt Auth Utils seals the browser session in `nuxt-auth-session`, an
  HttpOnly/Secure/SameSite=Lax cookie. `useUserSession()` is the single client
  source of truth, so SSR, hydration, client navigation, and public reader pages
  agree on the signed-in state.
- The session secret is derived from `JWT_SECRET` with HKDF-SHA256 and a fixed
  purpose (`scripts/session-secret.mjs`), then injected as `NUXT_APP_SECRET`
  before the server module loads (`scripts/start.mjs`). NUXT_APP_SECRET remains
  an explicit override for edge runtimes.
- Passwords use auth-utils' scrypt helper. Browser sessions and REST bearer
  tokens are separate: an Authorization header is validated on its own and never
  falls back to a cookie, and MCP refuses to run on a session alone.
- The single owner is created or adopted at first request
  (`server/utils/owner.ts`). The owner id is stable; username/password changes
  rotate credentials in place. A multi-user database fails with instructions
  unless `SERANGKAI_MIGRATION_OWNER_USER_ID` explicitly selects the owner.
- There is no registration route or page.

### Agent authorization (OAuth)
Serangkai is its own OAuth 2.1 authorization server for MCP clients, so a
hosted client can connect with a browser approval instead of a pasted token. It
does **not** depend on an external IdP: there is one owner and one login, and
adding a second system to configure would buy nothing.

- **Discovery is request-derived.** Nothing needs the deployment URL in
  advance. An unauthenticated `POST /api/mcp` returns a `401` whose
  `WWW-Authenticate` header names
  `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728); that document
  names the same origin as the authorization server, which serves RFC 8414
  metadata at `/.well-known/oauth-authorization-server` (also aliased at
  `/.well-known/openid-configuration`). Every URL is built by
  `server/utils/oauth-urls.ts` from the incoming request, honoring
  `X-Forwarded-*` and the existing `PUBLIC_BASE_URL` override for proxies that
  rewrite `Host`.
- **Endpoints.** `/oauth/authorize` (consent page and decision),
  `/oauth/register` (RFC 7591 dynamic registration, rate-limited),
  `/oauth/token` (authorization code + refresh rotation), `/oauth/revoke`
  (RFC 7009). PKCE `S256` is mandatory and the implicit flow does not exist.
- **Privilege ceiling.** OAuth grants can only be `read` or `write`. `full` —
  which can mint and revoke API tokens — is never grantable, so a connected
  agent cannot escalate into credential management. Only the scopes the owner
  leaves checked are persisted, even if the client asked for more; checking
  nothing is a denial, not a default.
- **Consent is explicit.** The page shows the client name, the exact redirect
  URI, and each permission in plain language. Registration alone grants
  nothing. Unknown clients and unregistered redirect URIs are answered with an
  error page, never a redirect; matching is exact except for loopback ports
  (RFC 8252 §7.3).
- **Grants are revocable.** Settings → Connected agents lists approved clients
  and disconnects them. Revocation deletes the whole grant, so the access token
  and its refresh token both die immediately. Refresh tokens rotate on every
  use, so a replayed one fails.
- **Storage.** `oauth_clients`, `oauth_codes` (keyed by the code's SHA-256, so
  the database never holds a usable code), and `oauth_tokens` (which links to
  the hashed `api_tokens` row so the existing request middleware authenticates
  it unchanged). `ensureOAuthSchema` adds these tables to pre-existing
  databases; it is additive and never rewrites rows.
- **Settings surfaces are session-only.** `requireSessionUser` guards token and
  grant management, so a bearer token cannot list credentials or disconnect
  clients — including an OAuth grant trying to enumerate its siblings.
- **HTTPS is required** by MCP clients except on loopback. A plain-HTTP LAN
  deployment will be rejected by the client, which is a property of the client
  rather than something the server can code around.

Hand-minted API tokens remain the right tool for scripts and CI; OAuth is the
convenience path for clients that support it. Both resolve to the same scoped
`api_tokens` row at request time.

### Security Considerations
- **Auth**: scrypt password hashes; sealed HttpOnly session cookies; rotated by changing ADMIN_PASSWORD or JWT_SECRET
- **API Tokens**: SHA-256 hashed, scoped (`read`/`write`/`full`), optional expiry
- **Authorization**: All private resources check ownership; API tokens checked for scopes
- **XSS/Sanitization**: Sanitize user input; careful with HTML rendering
- **Sandboxing**: HTML/JS artifacts rendered in sandboxed iframes with restrictive CSP; the opt-in Mermaid/chart runtime is same-origin, declarative, and network-denied
- **File Uploads**: Validate file types, size limits, scan if needed
- **Rate Limiting**: On auth endpoints and API
- **CSP**: Content Security Policy headers
- **Private Content**: Never leak private artifacts in public endpoints

## Deployment
- **Docker**: Single container with a persistent volume at `/data`
  (`DATABASE_PATH=/data/serangkai.db`, `STORAGE_PATH=/data/files`).
- **Required variables**: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`,
  `SHARE_SECRET`. Everything else has a working default.
- **Entrypoint**: creates the configured database/storage directories, fixes
  permissions for the `bun` user, and fails with an actionable error when the
  mount is missing or read-only.
- **Ports**: Expose 3000 by default
- **Healthcheck**: /api/health endpoint
- **Persistence**: `bun run test:docker` replaces a container on the same volume
  and checks the owner, artifacts, uploads, tokens, and share links.
- **Edge**: Cloudflare uses D1/R2; Vercel uses Node + S3 for durable data. Edge
  entry points set `NUXT_APP_SECRET` explicitly because they cannot be wrapped.
