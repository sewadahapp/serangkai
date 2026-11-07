# Docker deployment verification

## Verified locally

The repository was verified with Podman using the Bun-based multi-stage image:

```bash
podman build -t serangkai:local .
podman run -d --name serangkai-smoke -p 3810:3000 \
  -v /tmp/serangkai-podman-data:/app/data \
  -e NODE_ENV=production \
  -e JWT_SECRET=... \
  -e SHARE_SECRET=... \
  serangkai:local
```

Verified behavior:

- Image build succeeds with `oven/bun:1.4.0` and
  `bun install --frozen-lockfile --ignore-scripts`.
- `/api/health` returns `status: ok`.
- User registration and artifact creation succeed.
- Container restart succeeds.
- The registered user and artifact remain available after restart.
- The app runs the Nitro node-server output under Bun; Bun's built-in SQLite
  avoids a native `better-sqlite3` build in the image.

The Docker daemon itself is unavailable in the development environment, so this
is Dockerfile/container verification through Podman, not a claim that Docker
Engine was run here.

## Published image

Tagged releases publish multi-arch (`linux/amd64`, `linux/arm64`) images to GHCR
through `.github/workflows/docker.yml`:

```bash
docker pull ghcr.io/OWNER/REPO:latest
SERANGKAI_IMAGE=ghcr.io/OWNER/REPO:latest \
JWT_SECRET=... SHARE_SECRET=... \
docker compose -f docker-compose.image.yml up -d
```

`docker-compose.image.yml` runs a published image without building; it keeps the
same `/app/data` volume, required secrets, and healthcheck as the source-build
compose file. `docker-compose.yml` remains the local source-build path.

When building with Podman, pass `--format docker` if you need the image
`HEALTHCHECK` to be preserved; Podman's default OCI format drops it and the
warning is expected. The compose files define their own healthcheck regardless.

## Persistent volume

The entrypoint prepares `/app/data` and `/app/data/files`, then drops to the
image's unprivileged `bun` user. SQLite and uploaded files stay on the mounted
volume. A restart with the same volume must preserve users, artifacts, and
versions; that workflow is covered by the local Podman verification and the
container smoke test.
