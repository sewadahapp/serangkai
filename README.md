# Serangkai

A production-minded, open-source, self-hosted artifact and knowledge workspace for AI agents and humans.

## Features

- 🗂️ **Organized Workspace** - Nested folders, pages, and artifacts like Notion
- ✨ **Beautiful by Default** - Markdown renders with polished Selaras styling
- 🎨 **Interactive Artifacts** - HTML, JavaScript, Mermaid diagrams, TanStack charts, and static web apps
- 🤖 **Agent-Ready** - MCP and REST APIs for AI agents to create and update artifacts
- 🔒 **Private by Default** - Artifacts are private to their creator with explicit public sharing
- 🚀 **Simple Self-Hosting** - One container, SQLite + local filesystem by default, Bun runtime

## Quick Start with Docker

```bash
docker run -d -p 3000:3000 \
  -v serangkai-data:/app/data \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  -e SHARE_SECRET=$(openssl rand -base64 32) \
  -e NODE_ENV=production \
  ghcr.io/yourusername/serangkai:latest
```

The image runs the Nitro server output under Bun and stores all state under
`/app/data`.

## Development

Requires **Bun 1.4+** and Node 24 only when exercising the Node fallback.

```bash
# Install dependencies from the committed Bun lockfile
bun install --frozen-lockfile --ignore-scripts

# Start the dev server
bun run dev

# Build for production
bun run build

# Run the unit tests
bun test tests/markdown-render.test.mjs tests/toc-extract.test.mjs tests/artifact-runtime.test.mjs
```

`bun.lock` is the only committed lockfile. Do not add `package-lock.json` or run
npm to work around dependency issues. `--ignore-scripts` avoids Bun's optional
native rebuild of `better-sqlite3`; Bun uses `bun:sqlite` at runtime and the
prebuilt Node binary remains available for the Node fallback.

### Docker verification status

The image is designed for a single container with `/app/data` as the persistent
volume. The repository includes a healthcheck at `/api/health`. The Bun image was
verified locally with Podman (Docker-compatible): image build, health endpoint,
registration, artifact creation, restart, and persistence all passed. Docker
itself is not installed in the development environment, so a Docker Engine run
remains to be confirmed separately.

### InstaCloud status

An InstaCloud-specific deployment contract has not yet been independently
verified. Until the platform's current Docker/template documentation is
available, deploy the generated container using the platform's generic Docker
service with persistent storage mounted at `/app/data`; verify health and data
persistence before calling the deployment supported. See
`docs/deployment/instacloud.md` for the verification checklist.

### Cloudflare Workers and Vercel

Provider build commands are available:

```bash
bun run build:cloudflare
bun run build:vercel
```

Cloudflare uses Nitro's `cloudflare_module` preset, a request-scoped Drizzle D1
adapter, and a native R2 binding for artifact storage. The local
Wrangler/Miniflare test covers registration, artifact creation, binary upload,
and download. A remote Cloudflare deployment still requires a real D1 database,
R2 bucket, and `wrangler secret put` values.

Vercel uses Nitro's `vercel` preset and a Node 24 function runtime. The build and
local Node runtime are verified, but Vercel's filesystem is ephemeral: durable
production data still requires an external database plus `STORAGE_DRIVER=s3`.
See [`docs/deployment/README.md`](docs/deployment/README.md) for the complete
provider verification matrix and explicit unverified boundaries.

## Connect an AI agent

Create a scoped token from the workspace API, then configure an MCP client with the
Streamable HTTP endpoint:

```bash
claude mcp add --transport http serangkai http://localhost:3000/api/mcp \
  --header "Authorization: Bearer $SERANGKAI_API_TOKEN" --scope user
```

Use a token with `read` scope for discovery and reading, or `read,write` for
creating and updating artifacts. Tokens are hashed at rest and can be revoked.

## Tech Stack

- [Nuxt 4](https://nuxt.com/) - Full-stack framework (Nitro 2 / H3 v1)
- [TypeScript](https://www.typescriptlang.org/)
- [Bun](https://bun.sh/) - Package manager, scripts, tests, build, and container runtime
- [@sewadah/selaras](https://selarasui.my.id/) - UI components and styling
- [@nuxtjs/mdc](https://github.com/nuxt-modules/mdc) - Markdown/MDC rendering
- [SQLite](https://www.sqlite.org/) + [Drizzle ORM](https://orm.drizzle.team/)
- [Nitro](https://nitro.build/) - Server engine and storage abstraction

## License

MIT
