# AGENTS.md

Guidelines for AI agents working on Serangkai.

## Project
Serangkai is a production-minded, open-source, self-hosted rangka and knowledge workspace for AI agents and humans. It combines the organization of Notion, the interactive rangka capabilities of Claude Artifacts, and simplicity of lightweight self-hosted apps.

## Technology Stack
- **Framework**: Nuxt 4 + TypeScript, running on **Nitro 2 / H3 v1**
- **Toolchain**: **Bun 1.4+** for install, scripts, tests, builds, and the Docker runtime
- **UI/Styling**: `@sewadah/selaras` for UI, layouts, and document styling
- **Icons**: Lucide only; Selaras internal icon defaults are overridden in `shared/selaras-icons.ts` and `app/app.config.ts`
- **Markdown**: Comark (`comark` + `@comark/vue`) parsed once on the server into a sanitized document and rendered with `MarkdownDocument`; Mermaid and TanStack Charts are Vue components
- **Backend**: Nuxt/Nitro server routes, REST APIs, MCP integration
- **Auth**: Nuxt Auth Utils sealed browser sessions for one environment-configured
  owner account (`ADMIN_USERNAME` / `ADMIN_PASSWORD`); scoped SHA-256 API tokens
  are separate and never fall back to a browser session
- **Database**: Drizzle ORM; `bun:sqlite` under Bun, `better-sqlite3` under Node, request-scoped D1 on Cloudflare
- **Storage**: Nitro `useStorage()` over unstorage; filesystem by default, R2 binding on Cloudflare, S3-compatible storage (including Backblaze B2) on any runtime via `STORAGE_DRIVER=s3`
- **Deployment**: Docker (primary, persistent volume at `/data`), Cloudflare Workers, Vercel

## Terminology
- Use **rangka** for both singular and plural throughout UI, APIs, MCP, and internals.
- MCP tools explicitly describe the Serangkai workspace; advertise only `*_rangka` names.
- Legacy terminology is retained only where required for migration/compatibility or external product names.

## Core Principles
- **Agent-first**: Agents create/update/publish via MCP and REST APIs
- **Human-friendly**: Polished web UI for browsing, organizing, sharing
- **Beautiful by default**: Markdown renders nicely with Selaras styling without HTML/CSS from agents
- **Private by default**: Rangka owned by creator, explicit opt-in for public sharing
- **Security-first**: Treat authz, untrusted JS execution, private delivery as critical
- **Simple deployment**: Single container, no external deps required by default
- **Portable**: Nitro storage mounts for different platforms

## Development
- Use Bun as the package manager, script runner, test runner, and build runtime
- Keep `bun.lock` as the single committed lockfile; never add `package-lock.json`
- Use `bun install --frozen-lockfile` for reproducible installs
- Follow Nuxt 4 conventions and prefer built-in Nuxt/Nitro features
- Keep it simple, avoid over-abstraction
- Write tests for critical functionality
- Commit meaningful progress regularly
- Docker compilation must use `BUILDPLATFORM`, never QEMU. Release/rehearsal
  package the single tested node-server output through the Docker `prebuilt`
  target. Run `prepare-docker-output.mjs` first; its native-binary guard is a
  publication gate. Verify both target runtimes with `scripts/smoke-docker.sh`.

### Commands
```bash
bun install --frozen-lockfile --ignore-scripts
bun run dev                 # admin / serangkai-dev in development
bun run build
bun run start               # derives NUXT_APP_SECRET from JWT_SECRET
bun run test:auth
bun run test:docker         # real container replacement persistence check
bun run test:ci
```

Production requires `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, and
`SHARE_SECRET`. There is no registration route. Do not add a fifth required
variable for Docker/Node: the session key is derived from `JWT_SECRET`. Edge
platforms that cannot use `scripts/start.mjs` set `NUXT_APP_SECRET` explicitly.

Node 24 is retained only for the Node fallback and for Vercel/Node runtime
verification. Do not make npm the default.

## Authoring
- Markdown/Comark + Selaras for reports, documentation, and rich documents
- Declarative TanStack chart JSON for supported charts
- Mermaid for diagrams
- HTML for custom interfaces; the Selaras document theme is explicit opt-in
- `shared/rangka-components.ts` is the single source of truth for supported components; do not add renderer-only component lists
- MCP must advertise only implemented, verified capabilities

## Nitro version note
Nuxt 4.6.x uses **Nitro 2 / H3 v1** through `@nuxt/nitro-server`. Nitro 3 is a
release candidate and is not compatible with Nuxt 4's server integration. Do not
upgrade to Nitro 3 or adopt its `nitro/database`, `useKV`, or H3 v2 APIs until
Nuxt itself moves to that line.

## Documentation
Maintain: AGENTS.md, ARCHITECTURE.md, README.md.

## Security Notes
- Isolate untrusted HTML/JS execution (sandboxed iframes, CSP)
- Auth required for writes; scoped API tokens for agents
- Never let a browser session authorize MCP, and never fall back to a session when a bearer token is present
- Never add public registration; the single owner comes from the environment
- Private rangka must not be accessible without auth/permission
- Markdown is sanitized server-side; never evaluate author expressions or template code
- No secrets in code/logs
- Review security-critical changes carefully
