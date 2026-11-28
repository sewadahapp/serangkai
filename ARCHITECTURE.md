# Serangkai Architecture

## Overview
Serangkai is a Nuxt 4 application providing rangka storage, organization, and sharing for AI agents and humans.

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
  `scripts/serangkai-mcp.sh` is a stdio→HTTP bridge to `/api/mcp`. It supports
  a bearer token from the gitignored `.env.serangkai-mcp`,
  `SERANGKAI_MCP_AUTH=oauth` for a browser approval, and
  `SERANGKAI_MCP_AUTH=oauth-device` for the RFC 8628 device code, which is the
  path that works over SSH. MCP client wiring lives in the contributor's own
  local config; nothing about it is committed.
- **Agent support**: the `selaras` skill (copied from the installed package into
  `.opencode/skills/`) and the local `@sewadah/selaras-mcp` stdio server serve
  the offline catalog that ships inside `@sewadah/selaras`. Both are per-machine
  configuration and are gitignored.
- **Design system**: Minimalism & Swiss Style — trust blue `#2563EB` primary with an
  `#EA580C` accent, Plus Jakarta Sans, light mode by default with a dark mode toggle.
  Generated with the `ui-ux-pro-max` skill (variance 3 / motion 3 / density 5) and
  wired through `selaras.theme.colors` in `nuxt.config.ts`.
- **Content**: Comark (`comark` + `@comark/vue`) for Markdown parsing and component-driven rendering
- **Charts/Diagrams**: Mermaid, rendered theme-aware, and TanStack Charts through
  a JSON bar/line/area schema in Markdown and sandboxed HTML rangka.
  Author-supplied JavaScript is never evaluated.
- **Backend**: Nuxt Nitro server routes (Nitro 2 / H3 v1 via Nuxt 4)
- **Database**: Drizzle ORM with Bun's built-in SQLite under Bun, better-sqlite3
  under Node, and a request-scoped D1 adapter for Cloudflare; opt-in remote
  Turso/libSQL on all runtimes with `DATABASE_DRIVER=turso`
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

Rangka {
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

RangkaVersion {
  id: string
  rangkaId: string
  version: number
  contentPath: string
  metadata: JSON
  createdAt: Date
}

RangkaData {
  rangkaId: string // primary key with collection + docId
  collection: string // 1-64 of [A-Za-z0-9_-]
  docId: string // 1-64 of [A-Za-z0-9_-]
  data: JSON object // at most 64 KB stored
  bytes: number // stored JSON size, counted toward storage usage
  updatedBy: 'owner' | 'agent'
  createdAt: Date
  updatedAt: Date
}
```

#### Rangka data
Interactive HTML rangka keep live state, such as kanban cards, in `rangka_data`
instead of their source (`server/utils/rangka-data.ts`). Data is deliberately
not versioned: a moved card updates one row rather than copying the whole
rangka, and restoring an older version keeps the data. Limits: 64 KB per
document, 5000 documents and 5 MB per rangka, and the account storage limit.
The per-rangka limits are enforced inside the write itself: one
`INSERT … SELECT … WHERE <within limits> ON CONFLICT DO UPDATE … RETURNING`
statement, atomic on SQLite, D1, and libSQL, so concurrent writes cannot pass a
check together and overshoot. This matters most on D1 and Turso, where every
query is a network round trip. `GET …/:docId?optional=1` answers a missing
document with `{ document: null }` instead of a 404; the bridge uses it so a
first read does not log a browser error.

The HTML frame stays sandboxed with `connect-src 'none'`. Delivery injects a
small bridge (`server/utils/rangka-data-bridge.ts`) that exposes
`window.serangkai.data` and posts each call to the framing page;
`SerangkaiHtmlPreview` matches the sender to its own iframe, validates names,
and performs the request with the page's credentials
(`app/utils/rangka-data-bridge.ts`). The workspace page reads and writes; the
share reader can only read (`/api/share-data/:slug`, same access rules as the
share), so visitors interact with a local copy. Bundles do not get the bridge.
Rows are removed with their rangka; the delete route removes them explicitly
because a remote libSQL connection may not enforce foreign keys.

Local SQLite runs in WAL mode with a busy timeout, so page reads continue while
small data writes commit.

### Storage Layer
Rangka bytes use Nitro's built-in storage abstraction (`useStorage()` over
unstorage). Keys are the existing `userId/rangkaId/...` paths, so the local
filesystem layout and all existing rangka remain compatible.

- Local/Docker: `fs` driver mounted at `STORAGE_PATH` (default `./data/files`)
- Cloudflare: `cloudflare-r2-binding` driver mounted at `R2_BINDING`
  (default `RANGKA`), or the `serangkai-s3` driver when `STORAGE_DRIVER=s3`
- Vercel/portable: `serangkai-s3` driver when `STORAGE_DRIVER=s3`
- Static bundles are extracted into the same store under
  `userId/rangkaId/bundle/...`; no route reads the filesystem directly.
  Storage keys treat `:` like `/`, so bundle entry names and asset paths may
  not contain `:`, and the S3 driver refuses `.`/`..` key segments (the fs
  driver already does) so a key can never resolve to another object.

#### Static bundles

A bundle is a static website uploaded as a ZIP. `planBundle` checks the
archive before anything is written:

- It needs an `index.html` at the top level, or inside the single top-level
  folder that "compress folder" produces. That folder is removed from every
  path, so its `index.html` is the front page.
- Only web file types are allowed (HTML, CSS, JS, JSON, source maps, web app
  manifests, images, fonts, audio, video, PDF, text, XML). Any other file
  refuses the upload and the error names it, so a shared bundle cannot host
  executables on the Serangkai domain. Extensionless files are served as plain
  text.
- OS junk (`__MACOSX/`, dotfiles, `Thumbs.db`, `desktop.ini`) is skipped.
- Entry names with `..`, `.`, empty segments, `:` or a leading `/` refuse the
  upload.
- Limits: 500 files, 100 MB unpacked, 25 MiB archive.

Every bundle is extracted under its own `userId/rangkaId/bundle/` prefix, so
bundles never share or overwrite files. Duplicating a bundle extracts it again
under the copy's prefix.

Bundles are framed with `sandbox="allow-scripts"`, an opaque origin, so the
browser sends no session cookie with the bundle's own requests and relative
links drop a `?k=` query. The access key therefore leads the path:
`/api/share/<slug>/~<key>/index.html`. Unlisted bundles use their share key;
the owner's browser session gets a 12-hour view key from `GET /api/rangka/:id`
(`bundleUrl`) and the reader. API tokens never receive a view key, and an
owner's token reads bundle files only with `read` or `full` scope. Bundle
responses send `Referrer-Policy: no-referrer` so the key does not leak. Their
documents get the same sandbox policy as HTML rangka (inline styles and
scripts allowed, no network, no same-origin access), and
only allowed types are served, including from bundles uploaded before these
rules. Older bundles that still contain their top-level folder are read from
inside it.

#### Storage accounting and limits
Every version row records the bytes it stored in `rangka_versions.stored_bytes`
(content, plus unpacked files for a bundle's first version), and every rangka
data document its JSON size in `rangka_data.bytes`, so usage is two `SUM`s per
account and drops when a rangka is deleted. Rows written before
accounting existed are measured once, a batch per request, from driver metadata
(`server/utils/storage-quota.ts`).

- Owner limit and mode live in `workspace_settings` (per account), edited in
  Settings over a browser session only, so an agent token cannot raise its own
  limit. `warn` reports; `reject` refuses writes that would exceed the limit
  with HTTP 507 (an MCP tool error for agents). Deletes are always allowed.
- `STORAGE_LIMIT` is the operator cap: always enforced, and the owner limit
  cannot be set above it. A hosted deployment can later move it per account.
- Object stores (R2, B2, S3) expose no capacity, so only the local driver
  reports real disk size (`statfs` on `STORAGE_PATH`).
- Checks are not transactional; two writes racing at the limit can overshoot
  by at most one request.

#### Version retention
Every version is a full copy, so history is where storage grows. Old versions
can be removed three ways (`server/utils/version-pruning.ts`):

- Delete one version from the history panel
  (`DELETE /api/rangka/:id/versions/:version`).
- Clear older versions, keeping only the current one
  (`DELETE /api/rangka/:id/versions`). It removes up to 25 per request and
  returns `remaining`; the UI repeats until it is zero.
- The optional **Keep last N versions** setting (`workspace_settings.keep_versions`,
  null keeps all, the default). It runs inside each save that creates a
  version (REST, MCP, restore) and prunes at most 10 versions per save, so
  turning it on for a long history spreads the work over later saves instead
  of one request. There is no scheduled job, so it behaves the same on every
  runtime. A failed prune is logged and never fails the save.

The current version is never deleted, and neither is a bundle's first version,
whose row also accounts for the bundle's unpacked files. Rows are deleted
before files, and a file is only removed when no remaining version uses it.
Deleting and clearing require a browser session: history is the owner's
protection against an agent's bad writes, so API tokens and MCP cannot erase it.
The per-request caps keep each request within Cloudflare Workers' limit on
storage calls.

`server/plugins/storage.ts` mounts the driver once at startup, and
`server/utils/rangka-storage.ts` is the single read/write surface. The S3
driver (`server/utils/s3-driver.ts`) is a small unstorage adapter over
`aws4fetch` (SigV4 with a signed payload hash): Workers-compatible, prefix-aware
listing, loud write failures, configuration validated when the driver mounts
(clear messages naming the offending variable), and a bucket probe on first
storage use — Workers forbid network I/O during plugin initialization, so the
probe cannot run at mount. Every failure path mounts a driver whose operations
throw instead of leaving the mount empty, because Nitro swallows plugin errors
on Workers and an empty mount would fall back to unstorage's in-memory default.
On Cloudflare, a missing R2 binding fails startup rather than mounting an
in-memory driver; `SERANGKAI_ALLOW_EPHEMERAL_STORAGE=true` (non-production only)
exists solely for tests and local previews, and S3 has no memory fallback at all.

B2 buckets retain replaced and deleted object versions by default, and hidden
versions count toward storage. Deployments using B2 should add a bucket
lifecycle rule that keeps only the last version of each file (or deletes hidden
versions after one day) so that storage growth stays bounded; the rule runs once
per day and does not remove the current version.

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
- `GET /api/rangka` - List rangka (with filters)
- `POST /api/rangka` - Create rangka from text content. `bundle` and `pdf`
  are refused (use the upload); `image` must be SVG markup and is stored as
  `image/svg+xml`. MCP `create_rangka` and content updates follow the same rule.
- `POST /api/rangka/upload` - Multipart upload (Markdown, HTML, JSON, PDF, images, ZIP bundles)
- `GET /api/rangka/:id` - Get rangka
- `PUT /api/rangka/:id` - Update rangka, including visibility and folder.
  Content changes require `baseVersion`; a missing value is `400` and a stale
  one is `409` with `data.currentVersion`. The web editor sends the loaded
  version and reloads on conflict. The version row is inserted before its
  bytes are stored, so `UNIQUE(rangka_id, version)` picks one winner when
  writers race on the same `baseVersion`; the others get `409` and never
  overwrite the winner's file.
- `DELETE /api/rangka/:id` - Delete rangka
- `GET /api/rangka/:id/versions` - Version history
- `GET /api/rangka/:id/versions/:version` - Read a historical version
- `POST /api/rangka/:id/versions/:version/restore` - Restore a version as a new version
- `DELETE /api/rangka/:id/versions/:version` - Delete one older version (browser session only)
- `DELETE /api/rangka/:id/versions` - Clear older versions in batches (browser session only)
- `GET /api/rangka/:id/download` - Download the original source
- `GET /api/rangka/:id/preview` - Owner-only inline image/PDF preview
- `POST /api/rangka/:id/duplicate` - Copy an rangka as a new private rangka
- `POST /api/rangka/:id/share` - Build a public or signed unlisted share URL
- `GET /api/rangka/:id/data` - List a rangka's data collections with counts and sizes
- `GET /api/rangka/:id/data/:collection` - List documents (`read` scope)
- `GET|PUT|PATCH|DELETE /api/rangka/:id/data/:collection/:docId` - Read,
  replace, shallow-merge, or delete one document (`write` scope for changes).
  Bodies are `{ "data": { … } }`; writes never create a version
- `GET /api/share-data/:slug/:collection[/:docId]` - Read-only data for a
  shared rangka, under the share access rules. It is outside `/api/share/:slug/`
  because that prefix serves bundle files
- `GET /api/share/:slug` - Public/unlisted rangka delivery. Markdown redirects
  to the `/share/:slug` reader; `?format=json` returns its rendered data.
- `GET /api/share/:slug/*` - Scoped static bundle asset delivery
- `GET /api/search` - Search rangka/folders, optionally scoped to a folder subtree
- `GET /api/overview` - Workspace summary: counts, visibility, storage total, recent rangka
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
- `set_connection_name` - Name the OAuth connection the agent is using, so
  Settings can tell two installs of the same app apart. It never replaces a
  name the owner chose; API tokens cannot use it
- `list_folders` - List folders
- `search` - Search rangka and folders, optionally scoped to a folder subtree
- `create_folder` - Create a folder, optionally nested
- `list_rangka` - List user's rangka
- `get_rangka` - Read rangka content
- `create_rangka` - Create new rangka, optionally inside a folder
- `update_rangka` - Publish content, visibility, or folder changes.
  `baseVersion` (the version read with `get_rangka`) is **required whenever
  content changes**; a mismatch is refused with the current version so the agent
  can re-read and merge, the same stale-write guard Claude Code applies.
  Metadata-only updates are exempt, and unchanged content creates no version.
  Mutating tools declare `destructiveHint`.
- `read_rangka_data` - List a rangka's data collections, a collection's
  documents, or one document
- `write_rangka_data` - Apply up to 100 `set`/`update`/`delete` operations to
  rangka data in order, stopping at the first error. Needs `write`

Every tool declares an `outputSchema` and returns `structuredContent`, with the
same JSON repeated as text for older clients. List results are objects
(`{ folders }`, `{ rangka }`) because structured content must be an object.
Typed output lets clients generate a code API from the tools, which is how
"code mode" clients call MCP; Serangkai does not run agent-written code on the
server. Error results carry text only.

### Frontend Routes
- `/` - Private rangka workspace with paginated search, folder navigation, and
  list/grid views. Both views offer per-rangka menus for rename, duplicate,
  move, sharing, download, and delete. The selected view is stored in a first-party
  preference cookie; grid is the default without a saved preference.
  Signed-out visitors are redirected to owner login. The desktop app uses a
  persistent sidebar; mobile navigation and folder lists open in slideovers.
  Folder navigation uses Selaras `STree` with counts, connecting lines, and
  per-folder action menus. Chevron expansion is separate from folder selection,
  and expansion state is shared between the sidebar and mobile folder drawer.
  Expanded folder IDs are saved in browser `localStorage` across reloads and
  navigation. Without a saved preference, branches start collapsed. Successful
  folder fetches prune stale IDs; storage failures fall back to in-memory state.
- `/auth/login` - Owner login with labeled `SFormField` inputs; registration does not exist
- `/dashboard` - Compatibility redirect to `/`
- `/workspace` - Alias for `/`; `/workspace/new` opens the rangka editor
- `/rangka/[id]` - Rangka preview/edit. The rangka is fetched during SSR so
  the title renders on a direct load and a missing rangka answers 404; history,
  folders, and the share link load after the document. Markdown, HTML, JSON, and
  JavaScript open a full-viewport source workspace with an inline title, type and
  version, dirty state, and Save/Cancel. Preview mode puts content beneath a
  compact title/action bar; sharing and moving use dialogs, and paginated version
  history opens in a right-side slideover. Markdown uses a wider centered reader;
  shared Markdown centers the document independently of its right-hand contents
  rail, with collapsible contents above the document on smaller screens. HTML previews size to the document and scroll with the page,
  with `70vh` as the floor; Markdown already renders in-page. PDFs keep the
  browser's viewer and fill the content column.
- `/settings` - Appearance themes, light/dark mode, API token creation, listing,
  and revocation, plus connected-agent management in separate Selaras tabs.
  Token creation and its one-time secret display use a modal. Agent-guide links
  select the Tokens or Agents tab through the `tab` query parameter.
  Desktop sidebar account identity is static with a direct logout
  action; mobile account navigation opens in a slideover.
- `/agent` - MCP/REST connection guide with endpoint, client config, scope reference,
  publishing workflow (`baseVersion`), the HTML color-mode contract, and the
  Mermaid/chart marker syntax. A single-column setup flow uses Selaras tabs for
  browser sign-in, MCP tokens, and REST examples; advanced reference sections
  live in an accordion below a copyable starter prompt.
- `/share/[slug]` - Public reader for every shared rangka type. Only the
  Serangkai header is sticky; the footer is shared by every type but follows
  the content in normal flow. Markdown gets the workspace prose styles, Shiki,
  Mermaid, charts, and a contents rail; images sit in a document page. HTML,
  bundles, PDFs, and JSON/JavaScript skip the title card and use the full
  width: framed types are borderless and sandboxed (with the live color mode
  posted into them). Shared HTML grows to its content height through the
  injected height bridge, so the page owns the scrollbar; a
  `serangkai-presentation=app` meta keeps a bounded, internally scrolling
  frame for viewport-sized apps. PDFs use the browser viewer, and source files
  get a full-width highlighted code block. It has no workspace navigation and
  is `noindex`. Signed unlisted links pass `?k=`.
- Share delivery happens through `/api/share/:slug`, which applies visibility,
  always redirects Markdown to the reader, and redirects other types only for
  top-level browser navigations (`Sec-Fetch-Dest: document`). Frames, images,
  and direct fetches still receive raw bytes, so the reader can embed them
  without redirecting to itself. HTML rangka allow `frame-ancestors 'self'`
  for that frame, inject the height bridge, and keep the sandbox that denies
  same-origin access.

### Design system notes
- Semantic roles (`primary`, `accent`, plus Selaras builtins) are compiled at build
  time; components reference `var(--selaras-resolved-*)` tokens rather than raw hex.
- Appearance themes are a browser preference stored in the `serangkai-theme`
  cookie, not account data, so the share reader and signed-out pages can honor
  the same choice. `app/plugins/app-theme.ts` mirrors the value onto
  `<html data-serangkai-theme>` during SSR, which avoids a theme flash.
  `shared/themes.ts` is the shared registry for the settings picker and tests.
  The default `serangkai` theme stays compiled in `nuxt.config.ts`; additional
  themes override the public `--selaras-*` inputs in
  `app/assets/css/main.css` without duplicating component recipes. This follows
  the Selaras CSS-token guidance (https://selarasui.my.id/overview/theming/css-tokens).
  Rosé Pine uses the Dawn palette in light mode and the original palette in dark
  mode (https://rosepinetheme.com, MIT).
- Site identity lives in `shared/site.ts` and ships from `nuxt.config.ts`'s
  `app.head`: `titleTemplate: '%s · Serangkai'` (a string, because Nuxt
  serializes `app.head` with `JSON.stringify`, which drops functions), the
  description, Open Graph basics, `noindex` by default, and the icon links.
  Pages set only their short title and retain the default `noindex` policy.
  The icon set is a rounded mark for
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
  rangka security model. Invalid or empty definitions fall back to the raw
  JSON rather than a blank panel.
- Charts consume TanStack's `--ts-chart-1` … `--ts-chart-6` categorical tokens,
  bound to each theme in `app/assets/css/main.css`; switching Serangkai/Rosé
  Pine repaints the SVG without rebuilding the chart definition. Charts inside
  sandboxed HTML rangka remain self-styled and receive only light/dark mode,
  because the iframe does not inherit application CSS variables.
- Mermaid diagrams re-render when the color mode changes: `MermaidDiagram` uses
  `theme: 'neutral'` in light mode and `'dark'` in dark mode, observing the
  `class` attribute on `<html>`. Mermaid and chart components are wrapped in
  `ClientOnly`, so SSR sends readable fallback text and the browser hydrates the
  interactive diagram.
- Approved declarative and restricted-local-state Selaras components are
  defined in `shared/rangka-components.ts`, which is the single source of
  truth for renderer mappings, prop validation, MCP discovery, and authoring
  documentation. Forms, overlays, dashboard shells, and other application-state
  components are explicitly application-only. `get_rangka_capabilities`,
  resources, and prompts derive from this registry.
- HTML rangka remain self-styled by default. `<meta name="serangkai-theme"
  content="selaras-document">` opts into a locally served stylesheet generated
  from Selaras prose CSS; the link is injected only when that meta tag is
  present. The theme provides typography and colors, not Vue components.
- App-owned snippets (MCP config, curl examples, shell workflows) use
  `SerangkaiCode`, which wraps the real `SProsePre` so the header and copy
  button are the component's, and fetches only the highlighted body from
  `POST /api/highlight`. JSON and JavaScript rangka previews use it too, so
  uploaded source files read like code rather than plain text. That endpoint returns Shiki spans sanitized down to
  `pre`/`code`/`span`, or escaped text for unknown languages, and rejects
  snippets above 50,000 characters so the public route cannot be used to burn
  unbounded CPU. The agent connection guide uses it for client configuration
  and REST examples.
- `#selaras/tailwind.css` is imported in the Tailwind entry as the installation
  guide requires; it defines `--selaras-adaptive-breakpoint`, without which
  adaptive presentation warns and silently disables.
- HTML rangka follow the viewer's color mode. `server/utils/rangka-color-mode.ts`
  injects a small `color-scheme` + postMessage bridge; the in-app preview posts the
  live mode so rangka re-theme without a reload, while public share links bake the
  mode in from `Sec-CH-Prefers-Color-Scheme` and then follow `prefers-color-scheme`.
  Rangka can opt out with `<meta name="color-scheme" content="only light">`.
  `sandbox allow-scripts` still denies same-origin access, forms, popups, framing,
  and network calls.
- The HTML frame is granted one permission, `allow="fullscreen"`, so a rangka
  such as a slide deck can present full screen. The browser only enters full
  screen from a click or key press, shows its exit notice, and always exits on
  Esc; the sandbox and CSP still deny forms and the network, so a full-screen
  page cannot collect or send anything. Camera, microphone, clipboard, and other
  permissions stay denied; granting one is a separate decision.
- Workspace and shared HTML previews inject a sizing bridge
  (`server/utils/rangka-preview-height.ts`). Because the sandboxed frame is
  opaque-origin, the parent listens for a source-checked `serangkai:height`
  message and resizes the frame to the document height, so document-style
  rangka scroll with the page. Reports that equal the current frame height
  are ignored, which keeps `100vh` rangka from growing in a feedback loop.
- HTML and bundle pages can opt into a fixed canvas with the
  `serangkai-canvas` meta tag. The bridge reports the bounded dimensions and
  forwards canvas gestures from the active frame. The viewer validates input
  messages against that frame and pans and scales the fixed viewport. Holding
  Space temporarily engages a hand surface in the viewer so drag coordinates
  stay stable as the iframe moves. Normal clicks, editing, and scrollable
  regions keep their native behavior inside the frame.
- Sandboxed HTML rangka can render Mermaid and TanStack charts without a CDN
  by opting into a same-origin runtime. `server/utils/rangka-runtime.ts` scans
  the delivered HTML and injects only the bundles it needs:
  `/runtime/charts.js` for `[data-serangkai-chart]` and `/runtime/mermaid.js`
  for `.mermaid` / `[data-serangkai-mermaid]`. Chart definitions are JSON
  (`<script type="application/json" data-serangkai-chart>` or a data attribute),
  and Mermaid source stays declarative, so the runtime never evaluates rangka
  JavaScript. Both bundles are built by `scripts/build-rangka-runtime.mjs`
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
  Markdown line wrapping, and `Mod-S`. Add and edit screens use its embedded
  mode directly in the app content area, retaining the workspace navigation
  and a compact filename/cursor status footer. Title and save controls live in
  the page toolbar; new rangka also expose type, visibility, and folder fields.
  Route changes and browser exits protect unsaved drafts. The reusable framed
  mode retains its file tab, dirty dot, and fullscreen toggle.
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
  rangka 401/403/404 responses. Because it replaces `app.vue`, it includes its
  own `SApp`, header, footer, and color-mode toggle. Its illustration is an
  inline, themable SVG, so the page has no external asset dependency.
- Recoverable page-load failures stay inside the app shell through
  `SerangkaiErrorState`, with a retry action: workspace folders/rangka, the
  overview, API-token loading, and rangka loading all use it. Secondary
  rangka requests (history and folder names) use `Promise.allSettled`, so
  their failure cannot blank an rangka that already loaded.
- `SerangkaiErrorHero` is shared by the full-page error screen and the public
  share reader, so a missing or private share uses the same illustration,
  typography, status code, and recovery actions while keeping the reader's own
  header and footer.
- The default layout and the full-page error screen are flex columns with
  `min-h-dvh`; their footer sits at the viewport bottom when the content is
  shorter than the screen. The share reader uses a three-row grid so bounded
  frames fill the space between its header and footer while document content
  can grow the middle row.
- `NuxtErrorBoundary` wraps `NuxtPage`. A component failure keeps the layout and
  navigation available, and `router.afterEach` clears the boundary when the
  route changes so the fallback cannot cover the next page. The fallback's retry
  remounts the page; 404/401/403 from rangka loading use `showError` instead.
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
  tokens are separate: any Authorization header is validated on its own and
  never falls back to a cookie, and MCP refuses to run on a session alone. The
  Bearer scheme is parsed case-insensitively; a malformed header is an invalid
  credential, not a session.
- Login is throttled per process with a fixed window (ten failures per fifteen
  minutes by default). JSON and native form posts share the limit, unknown users
  run a dummy scrypt verification, and every failure is the same generic message.
  `X-Forwarded-For` is ignored unless `TRUST_PROXY=true` or the socket peer is in
  `TRUSTED_PROXY_IPS`; otherwise a caller could rotate the header to reset its
  bucket. A successful login clears the bucket and sets an HttpOnly, signed
  `serangkai_device` cookie (path `/api/auth/login`, one year). Later logins
  from that browser count against a per-device bucket instead of the address
  bucket, so a stranger exhausting the shared address (every visitor behind an
  untrusted reverse proxy) cannot lock the owner out of a known browser. The
  cookie only selects a bucket; it authorizes nothing. The first request that
  arrives with `X-Forwarded-For` on an untrusted socket logs a one-time warning
  naming `TRUST_PROXY`.
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
  rewrite `Host`. Set `PUBLIC_BASE_URL` in that deployment: without it, the
  incoming host is trusted for OAuth metadata and audience checks.
- **Endpoints.** `/oauth/authorize` (consent page and decision),
  `/oauth/register` (RFC 7591 dynamic registration, rate-limited),
  `/oauth/token` (authorization code + refresh rotation), `/oauth/revoke`
  (RFC 7009). PKCE `S256` is mandatory and the implicit flow does not exist.
- **Registration is bounded.** Only JSON is accepted, bodies are capped at
  32 KiB, redirect lists at ten entries of 2,048 characters, and client
  metadata at 500 characters. Only the `none` and `client_secret_post` auth
  methods the server can verify are accepted; anything else is rejected rather
  than downgraded. Requested scopes are capped at `read`/`write`.
- **Grants are audience-bound.** Every code, device grant, and token stores the
  canonical `${origin}/api/mcp` resource. A request may omit `resource` (it
  defaults to that one resource) but an explicit value must match structurally:
  same protocol, host, and path, with no query, fragment, or credentials. The
  token endpoint returns `invalid_target` on a mismatch, and `/api/mcp` rejects
  an access token issued for another resource. Legacy grants with a null
  resource are adopted on first refresh or first MCP request; hand-minted API
  tokens have no grant row and are unaffected.
- **Headless sign-in (RFC 8628).** `/oauth/device-authorization` issues a device
  code plus a short `WDJB-MJHT`-style user code; `/oauth/device` is the
  activation page where the owner types or follows it. The token endpoint
  accepts `urn:ietf:params:oauth:grant-type:device_code` and answers
  `authorization_pending` while the owner has not decided. This is what makes
  OAuth usable from an SSH session or container: no callback server and no port
  binding, so the browser can be on a different machine entirely. Device codes
  are stored hashed, single-use, and expire in ten minutes.
- **Rate limits.** Registration, consent, and token exchange are throttled per
  client address (`server/utils/rate-limit.ts`). The limiter is per process, so
  on Workers it bounds one isolate rather than the whole deployment; it raises
  the cost of a flood rather than promising a global ceiling. A successful token
  exchange clears its bucket so normal clients are never penalised.
- **Housekeeping.** Abandoned registrations (older than a week, never approved)
  and expired codes are pruned opportunistically on registration. Approved
  clients are never removed by that path.
- **Privilege ceiling.** OAuth grants can only be `read` or `write`. `full` —
  which can mint and revoke API tokens — is never grantable, so a connected
  agent cannot escalate into credential management. Only the scopes the owner
  leaves checked are persisted, even if the client asked for more; checking
  nothing is a denial, not a default.
- **Consent is explicit and request-bound.** The page shows the client name,
  the exact redirect URI, and each permission in plain language. Registration
  alone grants nothing. Unknown clients and unregistered redirect URIs are
  answered with an error page, never a redirect; matching is exact except for
  loopback ports (RFC 8252 §7.3). The GET stores a random nonce plus a
  fingerprint of the whole request in the sealed session; the POST must present
  the nonce and consumes the state once, so a cross-site form cannot approve a
  request the owner never rendered. Up to eight pending pages are kept for
  multiple tabs, and a bearer token cannot approve an OAuth client.
- **Grants are revocable.** Settings → Connected agents lists approved clients
  and disconnects them. Revocation deletes the whole grant, so the access token
  and its refresh token both die immediately. Refresh tokens rotate on every
  use, so a replayed one fails. Rotation is a conditional update inside a SQLite
  transaction or a D1 batch: exactly one concurrent request wins, the loser's
  new access token is deleted, and the grant id stays stable so Settings still
  shows one connection.
- **Connections are named per grant.** Clients register with their own
  `client_name`, so every install of one app looks the same. The consent pages
  ask the owner for a connection name (pre-filled with the client's), Settings
  can rename it, and an agent may name itself with `set_connection_name` until
  the owner has chosen one (`oauth_tokens.label_set_by`). Settings shows the
  last use, stamped on each request and on refresh.
- **Storage.** `oauth_clients`, `oauth_codes` (keyed by the code's SHA-256, so
  the database never holds a usable code), and `oauth_tokens` (which links to
  the hashed `api_tokens` row so the existing request middleware authenticates
  it unchanged, and stores the RFC 8707 `resource`). `ensureOAuthSchema` adds
  these tables and the `resource` column to pre-existing databases; it is
  additive and never rewrites rows. On D1, initialization is a shared
  per-isolate promise: concurrent requests wait for the same migration, and a
  failure clears the promise so the next request retries instead of serving a
  half-initialized schema.
- **Settings surfaces are session-only.** `requireSessionUser` guards token and
  grant management, so a bearer token cannot list credentials or disconnect
  clients — including an OAuth grant trying to enumerate its siblings.
- **Browser clients get CORS.** `server/middleware/oauth-cors.ts` answers
  preflight on the discovery, registration, token, revocation, and MCP paths
  and exposes `WWW-Authenticate`, so a browser-based MCP client can read the
  discovery URL. It sends `Access-Control-Allow-Origin: *` **without**
  `Allow-Credentials`, so a cross-origin page can never borrow the session
  cookie; the MCP endpoint still requires a bearer token.
- **Expired tokens are distinguishable.** When a bearer token is recognized but
  expired, the MCP `401` says so in the `WWW-Authenticate` description while
  still advertising discovery. A client can refresh instead of prompting the
  owner again; a revoked or unknown token gets the plain sign-in message.
- **HTTPS is required** by MCP clients except on loopback. A plain-HTTP LAN
  deployment will be rejected by the client, which is a property of the client
  rather than something the server can code around.
- **Dogfooded with a real client.** `mcp-remote` 0.16.5 (used by the repo's own
  `scripts/serangkai-mcp.sh` bridge) discovered the server, registered,
  completed PKCE with a browser approval, and called a tool against the built
  server — over both the browser flow and `--device-code`. That exercises a
  third-party implementation rather than only the bundled SDK.

Hand-minted API tokens remain the right tool for scripts and CI; OAuth is the
convenience path for clients that support it. Both resolve to the same scoped
`api_tokens` row at request time.

### Security Considerations
- **Auth**: scrypt password hashes; sealed HttpOnly session cookies; rotated by changing ADMIN_PASSWORD or JWT_SECRET; login throttled with generic failures and no X-Forwarded-For bypass by default
- **API Tokens**: SHA-256 hashed, scoped (`read`/`write`/`full`), optional expiry; OAuth tokens are audience-bound to `/api/mcp`
- **Authorization**: All private resources check ownership; API tokens checked for scopes; unlisted downloads require the share key; read-only tokens cannot mint share links
- **XSS/Sanitization**: Sanitize user input; careful with HTML rendering
- **Sandboxing**: HTML/JS rangka rendered in sandboxed iframes with restrictive CSP and no permissions except full screen; the opt-in Mermaid/chart runtime is same-origin, declarative, and network-denied
- **File Uploads**: Validate file types, size limits, scan if needed
- **Rate Limiting**: On auth endpoints and API
- **CSP**: Content Security Policy headers
- **Private Content**: Never leak private rangka in public endpoints

## Deployment
- **Docker**: Single container with a persistent volume at `/data`
  - Nuxt compiles once on BuildKit `BUILDPLATFORM`. Release and rehearsal reuse
    their tested node-server output via the `prebuilt` target and named `app`
    context; neither recompiles in Docker. The target-specific pinned Bun image
    supplies `bun:sqlite`. Docker preparation removes the unused Node SQLite
    prebuilds only from its copy and rejects any remaining native binaries.
  - Both target containers must pass bounded auth, SQLite, upload, and restart
    smoke tests before image promotion. ARM64 runtime tests may use QEMU;
    compilation never does. See [release build design](docs/release-builds.md).
  (`DATABASE_PATH=/data/serangkai.db`, `STORAGE_PATH=/data/files`).
- **Required variables**: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`,
  `SHARE_SECRET`. Everything else has a working default.
- **Entrypoint**: creates the configured database/storage directories, fixes
  permissions for the `bun` user, and fails with an actionable error when the
  mount is missing or read-only.
- **Ports**: Expose 3000 by default
- **Healthcheck**: /api/health endpoint
- **Persistence**: `bun run test:docker` replaces a container on the same volume
  and checks the owner, rangka, uploads, tokens, and share links.
- **Turso**: `DATABASE_DRIVER=turso` selects a network-only libSQL client using
  `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (optional for unauthenticated
  self-hosted libSQL). It takes precedence over D1 bindings and never falls back
  to local SQLite. Each process/isolate shares a lazy initialization promise;
  concurrent requests wait for schema readiness and transient failures retry.
  The shared rename migrations run before bootstrap; OAuth uses atomic batches
  and libSQL `rowsAffected` counts. Imports use `/web` to exclude native libSQL
  binaries. Existing databases must be imported explicitly; file content remains
  in the configured object store. Drizzle Kit honors the same selection.
- **Edge**: Cloudflare supports D1 or Turso independently of R2 or S3-compatible
  storage (Backblaze B2) with `STORAGE_DRIVER=s3`; Vercel uses Node + S3 for durable
  data, with Turso available as the external database. Cloudflare can also select
  Turso while keeping R2 or S3. Edge entry points set `NUXT_APP_SECRET` explicitly
  because they cannot be wrapped.
- **Cloudflare deployment**: users fork the repository and import the fork with
  Cloudflare Workers Builds, so updates arrive by syncing the fork. Four root
  Wrangler configurations cover the provider combinations, each with a `deploy*`
  script that builds the `cloudflare_module` preset before running Wrangler:
  `wrangler.jsonc` (D1 + R2, `deploy`), `wrangler.b2.jsonc` (D1 + B2,
  `deploy:b2`), `wrangler.turso.jsonc` (Turso + R2, `deploy:turso`), and
  `wrangler.turso-b2.jsonc` (Turso + B2, `deploy:turso-b2`, no D1/R2 bindings).
  All use the Worker name `serangkai` and omit account-specific D1/R2 ids, so
  Wrangler provisions them on the first deploy and later deploys reuse them.
  Secrets are added on the Worker and listed in `.dev.vars.example`. The Worker
  creates its schema on the first request, so there is no migration step. The
  Deploy to Cloudflare button is not used: it copies the repository instead of
  forking it, so copies never receive updates.
