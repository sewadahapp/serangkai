# Serangkai Architecture

## Overview
Serangkai is a Nuxt 4 application providing artifact storage, organization, and sharing for AI agents and humans.

## Technology Stack
- **Frontend/Framework**: Nuxt 4, Vue 3, TypeScript
- **UI Components**: @sewadah/selaras — 13 components in use (`SApp`, `SSelect`,
  `SFormField`, `SFileUpload`, `SCheckbox`, `SAlertDialog` via `useConfirm`,
  `SToast` via `useToast`, and others). `app.vue` mounts `SApp` once, which is
  required for `useToast`/`useConfirm`/`useModal` renderers to exist.
- **Local MCP dogfooding**: `npm run dev` is pinned to `127.0.0.1:6969`.
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
- **Content**: @nuxt/content with MDC for Markdown rendering
- **Charts/Diagrams**: Mermaid, rendered theme-aware, and TanStack Charts through
  a JSON bar/line/area schema. Author-supplied JavaScript is never evaluated.
- **Backend**: Nuxt Nitro server routes
- **Database**: Drizzle ORM with better-sqlite3 by default and a request-scoped D1 adapter for Cloudflare
- **Storage**: Local filesystem with adapter pattern; S3-compatible/R2 adapter for portable deployments
- **Auth**: Session cookies signed with `jose` + scoped API tokens
- **MCP**: Official `@modelcontextprotocol/sdk` Streamable HTTP transport

## System Design

### Data Model
```typescript
User {
  id: string (uuid)
  email: string
  passwordHash: string
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
  slug: string // URL-friendly unique identifier per user or globally?
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
Abstract storage interface to support multiple backends:
```typescript
interface StorageAdapter {
  save(key: string, data: Buffer | string): Promise<string>
  read(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getUrl?(key: string): Promise<string> // for presigned URLs if needed
}
```
Implementations: LocalStorageAdapter (default), S3StorageAdapter (future), etc.

### API Routes (Nitro)
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
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
- `GET /api/health` - Health check

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
- `/` - Landing page with capability, agent-setup, and CTA sections
- `/auth/login`, `/auth/register` - Auth pages with labeled `SFormField` inputs
- `/dashboard` - Workspace overview: counts, storage total, recent activity, types
- `/workspace` - Artifact workspace with folder tree, scoped search, create/upload panels
- `/artifacts/[id]` - Artifact preview/edit, sharing, folder, and version panels
- `/settings` - API token creation, listing, and revocation
- `/agent` - MCP/REST connection guide with endpoint, client config, scope reference,
  publishing workflow (`baseVersion`), and the HTML color-mode contract
- `/share/[slug]` - Public reader for shared Markdown: same prose styles, Shiki
  highlighting, Mermaid renderer, charts, and color mode as the workspace. It
  has no workspace navigation and is `noindex`. Signed unlisted links pass `?k=`.
- Share delivery happens through `/api/share/:slug`, which applies visibility
  and redirects Markdown to `/share/:slug`. HTML, PDF, image, JSON, and bundle
  content is still served raw.

### Design system notes
- Semantic roles (`primary`, `accent`, plus Selaras builtins) are compiled at build
  time; components reference `var(--selaras-resolved-*)` tokens rather than raw hex.
- `app/assets/css/main.css` holds the font face, shell width, prose measure, skip
  link, and a global `prefers-reduced-motion` override.
- All form controls live inside `SFormField` so labels, hints, and errors are
  programmatically associated. `SLabel` does not exist in Selaras.
- Markdown fenced code is highlighted with Shiki using `github-light` /
  `github-dark` dual themes emitted as `--shiki-light` / `--shiki-dark` custom
  properties, so one CSS rule switches with the color mode. Blocks mirror
  `SProsePre`'s chrome (language header + copy button) with plain markup, since
  sanitized Markdown output cannot carry Vue components. Unknown languages fall
  back to escaped text; Mermaid and `chart` fences keep their own renderers.
  Copying is delegated by `app/plugins/code-copy.client.ts`.
- Markdown headings get stable, unique ids after sanitization (`setup`,
  `setup-2`, ...). `SContentToc` uses them directly: the artifact sidebar and
  the share reader both build their contents tree with `extractToc`, which only
  reads the rendered HTML. The chart and Mermaid containers share the same
  border and surface tokens.
- Markdown `chart` fences accept JSON — `type` (`bar`, `line`, `area`), `data`,
  optional `x`/`y` keys, `title`, axis labels, `horizontal`, `color`, and
  `height`. `DataChart.client.vue` maps that onto fixed TanStack Charts marks and
  compact scales. The schema exists because chart definitions need functions,
  which JSON cannot carry; evaluating author JavaScript instead would break the
  artifact security model. Invalid or empty definitions fall back to the raw
  JSON rather than a blank panel.
- Mermaid diagrams re-render when the color mode changes: `MermaidDiagram` uses
  `theme: 'neutral'` in light mode and `'dark'` in dark mode, observing the
  `class` attribute on `<html>`. Both diagram types are mounted after the
  sanitized Markdown is in the DOM.
- App-owned snippets (MCP config, curl examples, shell workflows) use
  `SerangkaiCode`, which wraps the real `SProsePre` so the header and copy
  button are the component's, and fetches only the highlighted body from
  `POST /api/highlight`. That endpoint returns Shiki spans sanitized down to
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
  The CSP gains `script-src 'unsafe-inline'` for that bridge; `sandbox allow-scripts`
  still denies same-origin access, forms, popups, framing, and network calls.
- There are no native form elements left: text inputs use `SInput`, multi-line
  content uses `STextarea`, choices use `SSelect`, booleans use `SCheckbox`,
  files use `SFileUpload`, and dates use `SDatePicker` with
  `@internationalized/date` `DateValue`s.
- The global `:focus-visible` outline targets links and custom tabbables only.
  Form controls are excluded because Selaras draws its own focus ring, and an
  extra outline stacked a second ring on every focused field.

### Security Considerations
- **Auth**: Secure password hashing (argon2/bcrypt), HttpOnly secure cookies for sessions
- **API Tokens**: Hashed with SHA-256 or similar, prefixed for identification
- **Authorization**: All private resources check ownership; API tokens checked for scopes
- **XSS/Sanitization**: Sanitize user input; careful with HTML rendering
- **Sandboxing**: HTML/JS artifacts rendered in sandboxed iframes with restrictive CSP
- **File Uploads**: Validate file types, size limits, scan if needed
- **Rate Limiting**: On auth endpoints and API
- **CSP**: Content Security Policy headers
- **Private Content**: Never leak private artifacts in public endpoints

## Deployment
- **Docker**: Single container with volume for /data (SQLite DB + files)
- **Environment Variables**: Config via env vars
- **Ports**: Expose 3000 by default
- **Healthcheck**: /api/health endpoint
