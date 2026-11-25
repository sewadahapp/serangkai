# Configuration

Serangkai is configured entirely through environment variables. Docker and
Render read them from the container environment; on Cloudflare they are Worker
secrets (see the [Cloudflare guide](deploy-cloudflare.md)).

## Required

These four values must stay configured across redeployments:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | The owner login name. Changing it renames the same account. |
| `ADMIN_PASSWORD` | The owner password. Changing it rotates the stored hash on restart. |
| `JWT_SECRET` | Stable root secret for the sealed browser session. Rotating it signs everyone out. |
| `SHARE_SECRET` | Signs unlisted share links. Rotating it invalidates existing signed links. |

Generate each secret with `openssl rand -base64 32` or a password manager.
Registration is intentionally disabled: a self-hosted Serangkai instance has a
single owner account, and these variables define it.

Cloudflare Workers cannot derive the session key from `JWT_SECRET` at startup,
so they also need a stable `NUXT_APP_SECRET`. Docker, Node, and Render do not.

## Server

- `PUBLIC_BASE_URL` — canonical origin for OAuth metadata and audience checks.
  Set it when a reverse proxy rewrites `Host`.
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

The health check endpoint is `/api/health`. It reports that the server is up;
it does not check the database or file storage.

`SERANGKAI_ALLOW_EPHEMERAL_STORAGE` is test-only and must not be set in
production.

## File storage

- `STORAGE_DRIVER` — `local` (default for Docker/Node), `s3` (any S3-compatible
  provider, including Backblaze B2), or `r2-binding` (Cloudflare Workers only,
  and the default there). With `s3`, set `S3_ENDPOINT`, `S3_REGION`,
  `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.
- `STORAGE_LIMIT` — hard storage cap such as `10GB` (decimal `KB`/`MB`/`GB`/`TB`
  or binary `KiB`/`MiB`/`GiB`/`TiB`). Writes that would exceed it are refused.
  The owner can set a lower limit in **Settings → Storage** and choose whether
  reaching it only warns or refuses new writes. With local/Docker storage and
  no limit, the meter shows the real disk size of `STORAGE_PATH`.

Every version is stored in full and counts toward usage. Delete old versions
from a rangka's history, or set **Version history** in Settings to keep only
the last N.

## Database: Turso / remote libSQL

Local SQLite is the default. Select Turso instead with:

```dotenv
DATABASE_DRIVER=turso
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-database-token
```

This uses Drizzle's [libSQL adapter](https://orm.drizzle.team/docs/sqlite/connect-turso)
on Bun, Node/Vercel, and Cloudflare Workers. The network client accepts
`libsql://`, `https://`, and `http://` endpoints; an unauthenticated self-hosted
libSQL server can omit the token. An explicit Turso selection takes priority
over a Cloudflare D1 binding, and `DATABASE_PATH` is ignored when Turso is
selected. Configuration or connection failures surface as errors; they never
fall back to a local database.

The shared schema and upgrade migrations run before the first database request.
Existing SQLite data is **not copied automatically**: back up your database and
import it into Turso using its [migration guide](https://docs.turso.tech/cloud/migrate-to-turso)
before switching an existing installation. Keep the object store and stable
secrets with it: rangka content stays in filesystem/R2/S3 storage, while Turso
stores metadata, users, and tokens. On Vercel, pair Turso with
`STORAGE_DRIVER=s3`. Drizzle Kit also uses the selected Turso endpoint when
`DATABASE_DRIVER=turso`.

`bun run test:turso` checks the adapter and OAuth atomicity without cloud
credentials. `bun run test:turso-runtime` exercises the built server on Bun and
Node; `bun run test:cloudflare-runtime` checks both D1 and Turso in a local
Worker.
