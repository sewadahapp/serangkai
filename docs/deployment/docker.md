# Docker deployment verification

## Verified locally

The repository was verified with Podman using:

```bash
podman build -t serangkai:local .
podman run -d --name serangkai-smoke -p 3810:3000 \
  -v /tmp/serangkai-podman-data:/app/data \
  -e NODE_ENV=production \
  -e JWT_SECRET=... \
  -e SHARE_SECRET=... \
  -e DATABASE_PATH=/app/data/serangkai.db \
  -e STORAGE_PATH=/app/data/files \
  serangkai:local
```

Verified behavior:

- Image build succeeds.
- `/api/health` returns `status: ok`.
- User registration succeeds.
- Container restart succeeds.
- The registered user remains available after restart.

The Docker daemon itself is unavailable in the development environment, so this
is Dockerfile/container verification through Podman, not a claim that Docker
Engine was run here. The image uses Debian slim because native SQLite/Rolldown
dependencies were not reliable on Alpine with the current dependency lockfile.

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

## Container image smoke test

The image path was re-verified from a built image (not a source checkout) with a
persistent bind mount:

```bash
podman build -t serangkai:image-path-test .
podman run -d --name serangkai-image-test -p 3830:3000 \
  -v /tmp/serangkai-image-data:/app/data \
  -e JWT_SECRET=... -e SHARE_SECRET=... \
  -e DATABASE_PATH=/app/data/serangkai.db \
  -e STORAGE_PATH=/app/data/files \
  serangkai:image-path-test
```

Verified: `/api/health` returns ok, registration succeeds, artifact creation
succeeds, and the artifact is still listed after `podman restart` with the same
volume and session cookie.
