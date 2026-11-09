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

### Publishing an image

Images are published by the **Release** workflow, run manually from the Actions
tab: *Actions → Release → Run workflow*. It takes an optional exact version and a
bump, then in one run:

1. Runs `bun run test:ci`.
2. Bumps `package.json` from the conventional commits and writes `CHANGELOG.md`.
3. Builds `linux/amd64` and `linux/arm64` images.
4. Boots the built image and waits for `/api/health` to answer.
5. Promotes it to `:X.Y.Z` and `:latest`.
6. Pushes the release commit and an annotated `vX.Y.Z` tag.
7. Publishes a GitHub release with the changelog section as its notes.

The order is deliberate: each step is harder to undo than the last, and nothing
irreversible happens until the image has actually started. The image is staged
under a commit tag first; a failed build or a container that never answers
health leaves no version tag and no `:latest` behind.

**Recovering from a failure.** Re-run the workflow. The version is derived from
pushed tags, so an interrupted run recomputes the same version and resumes: if
the image was already staged or promoted from the same commit, the build is
skipped and the run continues to the tag and release. If a published image for
that version came from a different commit, it stops instead of overwriting it —
release a higher version instead.

To see what a release would do without publishing anything, run **Release
rehearsal**. It computes the version, writes the changelog in the runner, builds
the image, and smoke-tests it, then discards all of it.

A version is required to advance and tags are checked for collisions. Until the
first release there is no `:latest` image; build from source with
`docker compose up --build` instead.

The first published package is private by default, even from a public
repository, so anonymous `docker pull` returns 401 until it is set to public once
under *Package settings → Danger Zone → Change visibility*. That cannot be undone,
which is why the workflow does not do it automatically.

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
