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
