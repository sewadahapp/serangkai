# Serangkai

**A self-hosted workspace where you and your AI agents publish interactive work.**

Agents write reports, dashboards, small HTML apps, diagrams, and charts straight
into Serangkai over MCP. You browse, organize, edit, and share them from a web
UI on your own server, with everything private by default and every agent
working under scoped, revocable permissions.

[▶ Try the live demo](https://serangkai.onrender.com) ·
[Quick start](#quick-start-with-docker) ·
[Connect an AI agent](#connect-an-ai-agent) ·
[Authoring docs](docs/authoring/README.md)

> **Demo login:** username `serangkai`, password `serangkai`. The demo is a
> shared, disposable sandbox that anyone can sign into, so please don't store
> anything sensitive there. First load may take a moment on Render's free tier.

## Who is it for?

- **People who ask agents to build things** (a report, a dashboard, a small
  tool) and want the result to live somewhere permanent instead of in a chat
  transcript.
- **Agent builders** who need a real place for agents to read and write, with
  OAuth 2.1, PKCE, and scoped, revocable tokens rather than a shared password.
- **Self-hosters** who want one container, SQLite and local files by default,
  and no external services required.

## Why Serangkai?

Work an agent produces usually stays inside the chat or the product that made
it. Serangkai gives it a home you control: each piece of work is a **rangka**
with its own page, folder, version history, and optional share link.

Markdown, Mermaid diagrams, and declarative charts look polished without any
CSS or JavaScript. When you need more, HTML rangka and static web apps run your
own code inside a sandboxed iframe.

Agents are first-class authors, not an afterthought: MCP is built in, every
write is authenticated and scoped, and agents discover the full API through
`get_rangka_capabilities` and the `serangkai://guides/*` resources.

A rangka is a document, file, or interactive work saved in Serangkai. The name
is the same in the UI, REST API, and MCP tools: ask an agent to “create a
rangka in Serangkai” to identify the intended workspace.

## Demo

[![Serangkai workspace showing an interactive dashboard](https://github.com/user-attachments/assets/d985cacc-904a-434b-b73e-7e3f87fd52a8)](https://github.com/user-attachments/assets/1a2b5a60-8400-4256-a504-f0d41b9c55fa)

## Features

- 🗂️ **Organized Workspace** - Nested folders for pages, files, and interactive rangka
- ✨ **Beautiful by Default** - Markdown renders with polished Selaras styling
- 🖌️ **Themeable UI** - Switch between the Serangkai and Rosé Pine palettes in Settings; light and dark modes stay independent
- 🎨 **Interactive Rangka** - HTML, JavaScript, Mermaid diagrams, TanStack charts, and static web apps
- 🤖 **Agent-Ready** - MCP and REST APIs for AI agents to create and update rangka
- 🔒 **Private by Default** - Rangka are private to the workspace owner with explicit public sharing
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

Open `http://localhost:3000` and sign in with those credentials. The workspace
opens directly after login; public share links keep their own reader.
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

Optional deployment settings:

- `PUBLIC_BASE_URL` — canonical origin for OAuth metadata and audience checks.
  Set it when a reverse proxy rewrites `Host`.
- `STORAGE_DRIVER` — `local` (default for Docker/Node), `s3` (any S3-compatible
  provider, including Backblaze B2), or `r2-binding` (Cloudflare Workers only,
  and the default there). With `s3`, set `S3_ENDPOINT`, `S3_REGION`,
  `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
- `STORAGE_LIMIT` — hard storage cap such as `10GB` (decimal `KB`/`MB`/`GB`/`TB`
  or binary `KiB`/`MiB`/`GiB`/`TiB`). Writes that would exceed it are refused.
  The owner can set a lower limit in **Settings → Storage** and choose whether
  reaching it only warns or refuses new writes. With local/Docker storage and
  no limit, the meter shows the real disk size of `STORAGE_PATH`.
  Every version is stored in full and counts toward usage; delete old versions
  from a rangka's history, or set **Version history** in Settings to keep only
  the last N.
- `TRUST_PROXY=true`, or `TRUSTED_PROXY_IPS` with the proxy's socket addresses,
  makes rate limiting honor `X-Forwarded-For`. Set one when Serangkai runs
  behind a reverse proxy (Caddy, Traefik, nginx, a tunnel); otherwise every
  visitor shares the proxy's login limit, and the server logs a warning. Leave
  both unset when clients connect directly: the header is caller-controlled
  and is ignored by default.
- `SERANGKAI_LOGIN_RATE_LIMIT` / `SERANGKAI_LOGIN_RATE_WINDOW_MS` tune the
  per-process login throttle; `SERANGKAI_OAUTH_REGISTER_RATE_LIMIT`,
  `SERANGKAI_OAUTH_AUTHORIZE_RATE_LIMIT`, and
  `SERANGKAI_OAUTH_DEVICE_RATE_LIMIT` tune OAuth throttling.

`SERANGKAI_ALLOW_EPHEMERAL_STORAGE` is test-only and must not be set in
production.

Upgrading from the earlier custom-session build signs browsers out once (the
cookie format changed) and replaces email login with `ADMIN_USERNAME`. Existing
rangka, folders, versions, and API tokens are preserved. If the database has
more than one user, startup lists the ids; choose one with
`SERANGKAI_MIGRATION_OWNER_USER_ID`.

### Upgrading to the Rangka terminology

Back up the database and files together before upgrading. Startup automatically
renames the legacy `artifacts` and `artifact_versions` tables to `rangka` and
`rangka_versions`, including `artifact_id` → `rangka_id`. IDs, slugs, version
numbers, stored content paths, and signed share links are preserved. SQLite
startup automatically repairs empty duplicate tables left by a development
reload. If both legacy and new tables contain data, startup stops rather than
choosing one dataset. D1 retains the strict duplicate-table check.

Integrations must update `/api/artifacts` to `/api/rangka`, response fields
`artifact` / `artifacts` to `rangka`, and MCP names to `get_rangka_capabilities`,
`list_rangka`, `get_rangka`, `create_rangka`, and `update_rangka`. Reconnect MCP
clients to refresh tool discovery. Application detail URLs now use `/rangka/:id`;
public `/share/:slug` links stay the same. The legacy opt-in HTML theme URL
redirects to `/rangka-themes/selaras-document.css` for saved HTML that links it.

Cloudflare deployments now name the R2 binding `RANGKA`. Keep it mapped to the
same existing bucket. Alternatively set `R2_BINDING` to the binding name in your
existing deployment. Filesystem paths, S3 configuration, and object keys do not
change.

## Deploy to Cloudflare

[![Choose providers and deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](docs/deploy-cloudflare.md)

Choose your database (**D1 or Turso**) and file storage (**R2 or Backblaze B2**)
in the [deployment chooser](docs/deploy-cloudflare.md), then continue to the
matching Cloudflare setup page. Only your selected Cloudflare resources are
provisioned. **Turso + B2 requires neither a D1 nor an R2 binding.**

The chooser includes prerequisites, secret setup, and manual deployment
commands for all four combinations. Turso databases and B2 buckets must be
created in their respective services before deploying. Hosted deployments
still require verification with a login, rangka write, and file upload.

## Development

Requires **Bun 1.4+** and Node 24 only when exercising the Node fallback.

```bash
# Install dependencies from the committed Bun lockfile
bun install --frozen-lockfile --ignore-scripts

# Start the dev server
bun run dev

# Build for production
bun run build

# Run the Markdown and rangka runtime tests
bun run test:markdown
bun run test:runtime
```

`bun.lock` is the only committed lockfile. Do not add `package-lock.json` or run
npm to work around dependency issues. `--ignore-scripts` avoids Bun's optional
native rebuild of `better-sqlite3`; Bun uses `bun:sqlite` at runtime and the
prebuilt Node binary remains available for the Node fallback.

### Deployment status

The image is designed for a single container with `/data` as the persistent
volume, and the repository includes a healthcheck at `/api/health`. Verified
locally with Podman (Docker-compatible): image build, owner login, rangka
creation, binary upload, API-token use, unlisted sharing, and a full container
replacement on the same `/data` volume. Run `bun run test:docker` to repeat the
check with Podman or Docker.

Provider builds are available:

```bash
bun run build:cloudflare
bun run build:vercel
```

Cloudflare uses Nitro's `cloudflare_module` preset with D1 or Turso for rows
and R2 or S3-compatible storage for files. Local Wrangler/Miniflare tests cover
all four provider combinations, including signed B2 requests and a Turso + B2
Worker with no D1/R2 bindings. The D1 + B2 test also checks updates, deletes,
and persistence across a Worker restart. Vercel uses Nitro's `vercel` preset
and a Node 24 function
runtime, but its filesystem is ephemeral: durable data needs an external
database plus `STORAGE_DRIVER=s3`.

### Turso / remote libSQL

Select Turso instead of the local SQLite file with:

```dotenv
DATABASE_DRIVER=turso
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-database-token
```

This uses Drizzle's [libSQL adapter](https://orm.drizzle.team/docs/sqlite/connect-turso)
on Bun, Node/Vercel, and Cloudflare Workers. The network client accepts
`libsql://`, `https://`, and `http://` endpoints; an unauthenticated self-hosted
libSQL server can omit the token. An explicit Turso selection takes priority
over a Cloudflare D1 binding. Local SQLite remains the default, and
`DATABASE_PATH` is ignored when Turso is selected. Configuration or connection
failures surface as errors; they never fall back to a local database.

The shared schema and upgrade migrations run before the first database request.
Existing SQLite data is **not copied automatically**: back up your database and
import it into Turso using its [migration guide](https://docs.turso.tech/cloud/migrate-to-turso)
before switching an existing installation. Keep the object store and stable
secrets with it: rangka content stays in filesystem/R2/S3 storage, while Turso
stores metadata, users, and tokens. On Vercel, pair Turso with `STORAGE_DRIVER=s3`.
Drizzle Kit also uses the selected Turso endpoint when `DATABASE_DRIVER=turso`.

`bun run test:turso` checks the adapter and OAuth atomicity without cloud credentials.
`bun run test:turso-runtime` exercises the built server on Bun and Node;
`bun run test:cloudflare-runtime` checks both D1 and Turso in a local Worker.

### What has actually been exercised

Docker persistence is checked locally with Podman: the container is replaced on
the same volume and the owner, rangka, uploads, tokens, and share links are
verified. Vercel and Cloudflare are exercised through their credential-free
local test matrices, not a hosted deployment. Nothing in this repository deploys
anywhere on its own, and no platform is a supported contract until health and
persistence have been verified after a real deployment. Run
`bun run test:provider-local` for the local matrix.

Turso checks use the production libSQL HTTP client with a local SQLite-backed
Hrana fixture. Hosted Turso validation remains a deployment step.

### Publishing an image

Images are published by the **Release** workflow, run manually from the Actions
tab: *Actions → Release → Run workflow*. It takes an optional exact version and a
bump, then in one run:

1. Bumps `package.json` from conventional commits and writes `CHANGELOG.md`
   locally, saving the exact release candidate for recovery.
2. Runs `bun run test:ci`, compiling the candidate once on the native runner.
3. Packages that tested output into `linux/amd64` and `linux/arm64` images.
4. Boots **both** target runtimes and checks login, SQLite writes, uploads, and
   persistence after container replacement.
5. Promotes it to `:X.Y.Z` and `:latest`.
6. Pushes the release commit and an annotated `vX.Y.Z` tag.
7. Publishes a GitHub release with the changelog section as its notes.

The order is deliberate: each step is harder to undo than the last, and nothing
irreversible happens until the image has actually started. The image is staged
under a commit tag first; a failed build or a container that never answers
health leaves no version tag and no `:latest` behind.

**Recovering from a failure.** Use **Re-run failed jobs** on the same Actions run
within 30 days. Its saved candidate restores the exact version, commit, tag,
and notes, including after a successful git push. A matching staged image skips
compilation and packaging, but always repeats both runtime smoke tests. Recovery
compares manifest digests and refuses to overwrite a different published image.
An existing GitHub release is left intact. A new manual dispatch starts a new
release; it is not the way to resume a partly published one.

To see what a release would do without publishing anything, run **Release
rehearsal**. It computes the version, writes the changelog in the runner, builds
the images from the same tested output, and smoke-tests both architectures,
then discards all of it.

Nuxt/Vite builds never run under QEMU. `BUILDPLATFORM` handles source builds;
only the short ARM64 runtime verification uses emulation on an AMD64 runner.
If ARM64 verification is unavailable, select **linux/amd64** in the release or
rehearsal `platforms` input. This publishes an explicitly AMD64-only image; it
does not silently claim ARM64 support or extend a timeout. For the hand-pushed
tag workflow, repository variable `SERANGKAI_IMAGE_PLATFORMS=linux/amd64` selects
the same fallback. See [build strategy, recovery, and measurements](docs/release-builds.md).

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
declarative TanStack charts without writing CSS or JavaScript. HTML rangka are
self-styled by default and can opt into the Selaras document theme.

MCP clients can discover everything through `get_rangka_capabilities` and the
`serangkai://guides/*` resources. See
[`docs/authoring/README.md`](docs/authoring/README.md).

## Connect an AI agent

Serangkai is its own OAuth 2.1 authorization server, so MCP clients can connect
three ways. All of them end at the same Streamable HTTP endpoint,
`https://<your-host>/api/mcp`.

**Browser OAuth (recommended for interactive clients).** A client that supports
OAuth discovers the authorization server from the endpoint's `401` response,
opens your browser to the consent screen, and you approve the requested scopes.
No secret is pasted into the client. Authorization codes use PKCE (S256) and
every grant is bound to the MCP resource.

**Device authorization (headless clients).** For SSH sessions, containers, or
CI where no browser callback is possible, the client requests a device code and
prints a short user code. Open `https://<your-host>/oauth/device`, sign in, enter
the code, and approve. The client polls until the grant is issued.

**Manual API token.** Create a scoped token in *Settings → API tokens* and pass
it as a bearer header:

```bash
claude mcp add --transport http serangkai http://localhost:3000/api/mcp \
  --header "Authorization: Bearer $SERANGKAI_API_TOKEN" --scope user
```

Use `read` for discovery/reading and `read,write` for creating/updating.
OAuth grants are capped at `read`/`write`; only a manually minted `full` token
can manage other tokens. Tokens are hashed at rest and revocable, and a
read-only token can never mint share capability links.

## Backup and restore

Back up the database and the object store together, and keep the secrets
(`JWT_SECRET`, `SHARE_SECRET`, and on Workers `NUXT_APP_SECRET`) stable —
rotating them invalidates sessions and existing unlisted links.

**Docker / SQLite.** Everything lives under `/data` (`serangkai.db` plus the
`files/` object store). Stop the container and copy the volume, or take a hot
SQLite backup with `sqlite3 /data/serangkai.db ".backup '/backup/serangkai.db'"`
and copy `files/` alongside it. Restore by mounting the same `/data` volume.

**Cloudflare D1.** Export with `wrangler d1 export <database> --output backup.sql`
(or use D1 Time Travel for point-in-time recovery). Restore into a database with
`wrangler d1 execute <database> --file backup.sql`.

**Object storage.** R2: sync with `wrangler r2 object` commands or `rclone sync`.
Backblaze B2: `b2 sync` or `rclone sync` against the S3 endpoint. Keep the bucket
private; rangka bytes are meaningless without the matching database rows.

A restore is only consistent if the database and object store come from the same
point in time, and the secrets match the ones in use when the backup was taken.

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
