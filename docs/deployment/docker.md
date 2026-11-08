# Docker deployment

Serangkai ships as one container: the Nitro server output runs under Bun, with
SQLite and artifact files on a mounted volume.

## Quick start

```bash
docker build -t serangkai:local .
docker run -d --name serangkai -p 3000:3000 \
  -v serangkai-data:/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD='choose-a-strong-password' \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  -e SHARE_SECRET=$(openssl rand -base64 32) \
  serangkai:local
```

Or with Compose:

```bash
ADMIN_USERNAME=admin \
ADMIN_PASSWORD='choose-a-strong-password' \
JWT_SECRET=$(openssl rand -base64 32) \
SHARE_SECRET=$(openssl rand -base64 32) \
docker compose up -d
```

Only the four variables above are required. The image already sets
`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`,
`DATABASE_PATH=/data/serangkai.db`, `STORAGE_PATH=/data/files`, and
`STORAGE_DRIVER=local`.

Open `/auth/login` and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
Registration does not exist; the instance has one owner account.

## Volume and durability

- Mount a persistent volume at **`/data`** (the conventional path used by
  InstaCloud and most container platforms).
- The entrypoint creates the database directory and storage directory, fixes
  ownership for the unprivileged `bun` user, and fails with an actionable error
  when the path is missing or read-only.
- `DATABASE_PATH` and `STORAGE_PATH` still work as overrides. Relative values
  are resolved from `/app`, absolute values are used as-is.
- **Without a persistent volume the deployment is not durable.** SQLite can
  initialize successfully inside the container, but everything is lost when the
  container is replaced.

### Moving an existing `/app/data` deployment

Existing installations may have data under `/app/data`. Nothing is moved
automatically. To migrate safely:

```bash
docker stop serangkai
docker cp serangkai:/app/data ./serangkai-data-backup
docker create --name serangkai-data-helper -v serangkai-data:/data busybox
docker cp ./serangkai-data-backup/. serangkai-data-helper:/data
docker rm serangkai-data-helper
docker rm serangkai
docker run -d --name serangkai -p 3000:3000 -v serangkai-data:/data \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='...' \
  -e JWT_SECRET=... -e SHARE_SECRET=... serangkai:local
```

Verify by signing in and opening an existing artifact before deleting the
backup. The database schema is migrated in place on startup.

## Credentials and rotation

| Change | Effect |
| --- | --- |
| `ADMIN_USERNAME` | Renames the existing owner account on restart. |
| `ADMIN_PASSWORD` | Rotates the stored password hash on restart. |
| `JWT_SECRET` | Invalidates all sealed browser sessions (everyone signs in again). |
| `SHARE_SECRET` | Invalidates existing signed unlisted links. |

The owner account is created once and keeps a stable id, so artifacts, folders,
versions, and API tokens remain attached across restarts and credential changes.

### Existing databases with multiple users

The startup migration refuses to guess. If the database contains more than one
user, the app fails with an error listing the user ids and instructions. Choose
the owner explicitly:

```bash
-e SERANGKAI_MIGRATION_OWNER_USER_ID=<user-id>
```

The chosen account is adopted; other accounts keep their rows but lose their
username, so they can no longer sign in or use API tokens. No user data is
deleted or reassigned.

## Persistence verification

```bash
bun run test:docker
```

This builds the image with Podman (or Docker, if that is the available runtime),
creates an owner, artifacts, an uploaded file, an API token, and an unlisted
share link, then replaces the container on the same `/data` volume. It asserts
that login, artifacts, uploaded bytes, the token, and the share link still work.

## Image details

- Multi-stage build on `oven/bun:1.4.0`; the runtime stage is
  `oven/bun:1.4.0-slim`.
- The app runs as the unprivileged `bun` user.
- The container `HEALTHCHECK` calls `/api/health`. Podman's default OCI format
  drops `HEALTHCHECK`; Compose files define their own.
- Published images are multi-arch (`linux/amd64`, `linux/arm64`) via
  `.github/workflows/docker.yml`.
