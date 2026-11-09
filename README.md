# Serangkai

A production-minded, open-source, self-hosted artifact and knowledge workspace for AI agents and humans.

## Features

- 🗂️ **Organized Workspace** - Nested folders, pages, and artifacts like Notion
- ✨ **Beautiful by Default** - Markdown renders with polished Selaras styling
- 🎨 **Interactive Artifacts** - HTML, JavaScript, Mermaid diagrams, TanStack charts, and static web apps
- 🤖 **Agent-Ready** - MCP and REST APIs for AI agents to create and update artifacts
- 🔒 **Private by Default** - Artifacts are private to the workspace owner with explicit public sharing
- 👤 **Single-owner, zero-registration** - One account configured from environment variables; no sign-up flow
- 🚀 **Simple Self-Hosting** - One container, SQLite + local filesystem by default, Bun runtime

## Quick Start with Docker

```bash
docker run -d -p 3000:3000 \
  -v serangkai-data:/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD='choose-a-strong-password' \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  -e SHARE_SECRET=$(openssl rand -base64 32) \
  ghcr.io/sewadahapp/serangkai:latest
```

Open `http://localhost:3000/auth/login` and sign in with those credentials.
Registration is intentionally disabled: a self-hosted Serangkai instance has a
single owner account. The image runs the Nitro server output under Bun and
stores SQLite plus uploaded files under `/data`, so a volume mounted there is
the only persistence you need.

These four values must stay configured across redeployments:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | The owner login name. Changing it renames the same account. |
| `ADMIN_PASSWORD` | The owner password. Changing it rotates the stored hash on restart. |
| `JWT_SECRET` | Stable root secret for the sealed browser session. Rotating it signs everyone out. |
| `SHARE_SECRET` | Signs unlisted share links. Rotating it invalidates existing signed links. |

`SERANGKAI_ALLOW_EPHEMERAL_STORAGE` is test-only and must not be set in
production.

Upgrading from the earlier custom-session build signs browsers out once (the
cookie format changed) and replaces email login with `ADMIN_USERNAME`. Existing
artifacts, folders, versions, and API tokens are preserved. If the database has
more than one user, startup lists the ids; choose one with
`SERANGKAI_MIGRATION_OWNER_USER_ID`.

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

### Deployment status

The image is designed for a single container with `/data` as the persistent
volume, and the repository includes a healthcheck at `/api/health`. Verified
locally with Podman (Docker-compatible): image build, owner login, artifact
creation, binary upload, API-token use, unlisted sharing, and a full container
replacement on the same `/data` volume. Run `bun run test:docker` to repeat the
check with Podman or Docker.

Provider builds are available:

```bash
bun run build:cloudflare
bun run build:vercel
```

Cloudflare uses Nitro's `cloudflare_module` preset, a request-scoped Drizzle D1
adapter, and a native R2 binding. The local Wrangler/Miniflare test covers owner
login, artifact creation, binary upload, and download. Vercel uses Nitro's
`vercel` preset and a Node 24 function runtime, but its filesystem is ephemeral:
durable data needs an external database plus `STORAGE_DRIVER=s3`.

### What has actually been exercised

An InstaCloud-hosted instance was deployed by hand and checked from the outside:
`/api/health` returns 200, the OAuth discovery documents resolve, an
unauthenticated `/api/mcp` request returns 401 with a `WWW-Authenticate`
challenge, CORS preflight answers, dynamic client registration succeeds, and
static assets load. That instance predates the current build, so it needs a
redeploy to pick up later changes (including the device grant).

That is a smoke test of one deployment, not a supported platform contract.
InstaCloud's container and template specifics are not documented here, nothing
in this repository deploys anywhere on its own, and data persistence across a
container replacement has only been verified locally with Podman. Vercel and
Cloudflare have likewise only been exercised locally. Run
`bun run test:provider-local` for the credential-free local matrix, and verify
health plus persistence after any real deployment before treating it as
supported.

## Authoring

Markdown is rendered with Comark and styled by Selaras. Agents can create
tables, task lists, callouts, cards, tabs, timelines, Mermaid diagrams, and
declarative TanStack charts without writing CSS or JavaScript. HTML artifacts are
self-styled by default and can opt into the Selaras document theme.

MCP clients can discover everything through `get_artifact_capabilities` and the
`serangkai://guides/*` resources. See
[`docs/authoring/README.md`](docs/authoring/README.md).

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
- [Comark](https://comark.dev/) - Markdown parsing and component rendering
- [SQLite](https://www.sqlite.org/) + [Drizzle ORM](https://orm.drizzle.team/)
- [Nitro](https://nitro.build/) - Server engine and storage abstraction

## License

MIT — see [LICENSE](LICENSE).
