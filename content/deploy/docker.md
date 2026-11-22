---
title: Docker
description: Run Serangkai as a single container with a persistent volume.
order: 1
---

# Docker

Docker is the primary deployment. The image runs the Nitro server under Bun and
stores SQLite plus uploaded files under `/data`.

```sh
docker run -d -p 3000:3000 \
  -v serangkai-data:/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD='choose-a-strong-password' \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  -e SHARE_SECRET=$(openssl rand -base64 32) \
  ghcr.io/sewadahapp/serangkai:latest
```

The image is published for `linux/amd64` and `linux/arm64`, and exposes a
health check at `/api/health`.

## Behind a reverse proxy

When Serangkai runs behind Caddy, Traefik, nginx, or a tunnel:

- Set `PUBLIC_BASE_URL` to the public origin if the proxy rewrites `Host`. OAuth
  metadata and audience checks use it.
- Set `TRUST_PROXY=true`, or list the proxy's addresses in `TRUSTED_PROXY_IPS`,
  so rate limiting reads `X-Forwarded-For`. Otherwise every visitor shares the
  proxy's login limit.

## Storage options

Local files are the default. To keep files in object storage instead, set
`STORAGE_DRIVER=s3` with `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Any S3-compatible provider
works, including Backblaze B2.

To use a remote database, see [Turso](/deploy/turso).

## Build from source

```sh
git clone https://github.com/sewadahapp/serangkai.git
cd serangkai
docker compose up --build
```
