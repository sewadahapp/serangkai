# Serangkai

A production-minded, open-source, self-hosted artifact and knowledge workspace for AI agents and humans.

## Features

- 🗂️ **Organized Workspace** - Nested folders, pages, and artifacts like Notion
- ✨ **Beautiful by Default** - Markdown renders with polished Selaras styling
- 🖌️ **Themeable UI** - Switch between the Serangkai and Rosé Pine palettes in Settings; light and dark modes stay independent
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

Optional deployment settings:

- `PUBLIC_BASE_URL` — canonical origin for OAuth metadata and audience checks.
  Set it when a reverse proxy rewrites `Host`.
- `STORAGE_DRIVER` — `local` (default for Docker/Node), `s3` (any S3-compatible
  provider, including Backblaze B2), or `r2-binding` (Cloudflare Workers only,
  and the default there). With `s3`, set `S3_ENDPOINT`, `S3_REGION`,
  `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
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
artifacts, folders, versions, and API tokens are preserved. If the database has
more than one user, startup lists the ids; choose one with
`SERANGKAI_MIGRATION_OWNER_USER_ID`.

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai)

The button clones this repository into your GitHub or GitLab account, provisions
a D1 database and R2 bucket, and prompts for the secrets listed in
`.dev.vars.example`. It then configures Workers Builds, so pushes to the new
repository's production branch redeploy automatically.

`NUXT_APP_SECRET` is required on Workers: unlike the Docker and Node entry
points, the Worker cannot run `scripts/start.mjs` to derive a session key from
`JWT_SECRET`. Generate each random value with `openssl rand -base64 32` and keep
them stable across deploys. The `deploy` script builds with
`NITRO_PRESET=cloudflare_module` before running Wrangler; the Worker creates its
D1 schema on the first request, so no separate migration command is needed.

If the setup page pre-populates a separate build command, it may be left blank
or set to `bun run build:cloudflare`; the deploy script performs the Cloudflare
build itself. Manual deployments can add the D1 `database_id` and R2
`bucket_name` returned by Wrangler instead of relying on automatic provisioning.

### Deploy to Cloudflare with Backblaze B2

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-b2)

Backblaze B2 provides an S3-compatible API, so it can replace R2 while D1 keeps
every database row. This path needs no R2 bucket — and therefore no R2
activation or billing card. The free B2 tier includes 10 GB of storage, free
egress up to 3× your average monthly stored data, and the first 2,500 Class D
downloads per day; beyond those limits Backblaze bills storage, egress, and API
calls, so this is not a permanently free setup.

Before deploying, create **a private bucket** and **a bucket-scoped application
key** in Backblaze, then note the endpoint (`https://s3.<region>.backblazeb2.com`),
region, bucket name, key ID, and application key.

B2 keeps old object versions by default, and hidden versions still count toward
storage. Add a lifecycle rule with an empty file prefix that keeps only the last
version of each file — in the console, **Keep only the last version of the
file**, or set **Days from hiding to deleting** to `1` and leave **Days from
uploading to hiding** empty. Do not set the upload-to-hiding value: it hides the
current version too. Lifecycle rules run once per day, so recently replaced
versions can still appear in usage until the next run.

The second button deploys from the thin template in
[`deploy/cloudflare-b2/`](deploy/cloudflare-b2/README.md): it provisions D1,
prompts for the same owner and session secrets plus the five `S3_*` values, and
builds the application source at deploy time. Two buttons exist because the
Deploy to Cloudflare platform reads one Wrangler configuration per repository.
The template is a launcher, not a copy of the app: `build.mjs` downloads
`sewadahapp/serangkai` at `master` unless you set `SERANGKAI_REF` to a tag or
commit (and `SERANGKAI_REPO` for a fork). Editing the cloned template does not
change the deployed application.

Manual deployment works from the repository root:

```bash
bun run build:cloudflare
wrangler d1 create serangkai        # paste the database_id into wrangler.b2.jsonc
wrangler deploy --config wrangler.b2.jsonc
```

Then set the secrets once with `wrangler secret put S3_ENDPOINT`, `S3_REGION`,
`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and the four required
authentication secrets plus `NUXT_APP_SECRET`. `S3_ENDPOINT` must be the full
URL including `https://` (Backblaze displays the hostname without the scheme);
`S3_REGION` is the region segment of that endpoint, such as `us-west-004`. If
storage is misconfigured, artifact writes fail with a clear error instead of
falling back to Worker memory — the rest of the app still loads, so a health
check alone does not prove uploads work. `bun run deploy:b2` builds and deploys
with the same config. On Workers, uploads and downloads are stored in B2 and
survive redeployments as long as the secrets stay stable; D1 holds the
metadata.

The B2 path is verified locally with the Workers runtime against a
Backblaze-compatible mock — signed requests, binary round-trips, and persistence
across a Worker restart — but the hosted button flow has not been run against a
real Cloudflare account and B2 bucket. Treat the first hosted deployment as
something to verify.

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
login, artifact creation, binary upload, and download; a second local Worker
run covers the B2 path with D1, no R2 binding, and a Backblaze-compatible mock
(signing, binary integrity, artifact update/delete, and persistence across a
Worker restart). Vercel uses Nitro's `vercel` preset and a Node 24 function
runtime, but its filesystem is ephemeral: durable data needs an external
database plus `STORAGE_DRIVER=s3`.

### What has actually been exercised

Docker persistence is checked locally with Podman: the container is replaced on
the same volume and the owner, artifacts, uploads, tokens, and share links are
verified. Vercel and Cloudflare are exercised through their credential-free
local test matrices, not a hosted deployment. Nothing in this repository deploys
anywhere on its own, and no platform is a supported contract until health and
persistence have been verified after a real deployment. Run
`bun run test:provider-local` for the local matrix.

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
private; artifact bytes are meaningless without the matching database rows.

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
