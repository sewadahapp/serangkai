# Remote deployment verification runbook

This runbook is intentionally procedural. Completing a local build or dry-run
does not make a provider deployment verified.

If credentials or a provider environment are unavailable, use
`bun run test:provider-local` and record the target as **not deployed** rather
than attempting to infer remote support from local output.

## Common acceptance checks

For every provider, record the date, deployment URL, image/build identifier,
runtime version, and result for:

1. `/api/health` returns `200` and `{ "status": "ok" }`.
2. Owner login works with ADMIN_USERNAME / ADMIN_PASSWORD; registration is absent.
3. A private Markdown artifact can be created, read, and updated.
4. A public artifact is shareable while a private artifact is denied anonymously.
5. An unlisted artifact requires its signed capability link.
6. A binary upload can be downloaded unchanged.
7. Restart/redeploy preserves the owner, artifacts, uploads, API tokens, and
   unlisted share links when durable storage is configured.
8. Logs contain no secrets or password material.

## Cloudflare Workers + D1 + R2

Required before verification:

- A Cloudflare account and Wrangler authentication.
- A real D1 database bound as `DB`.
- A real R2 bucket bound as `ARTIFACTS`.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, and `SHARE_SECRET` set with
  `wrangler secret put`.
- `NUXT_APP_SECRET` set to the output of
  `bun scripts/derive-session-secret.mjs "$JWT_SECRET"` (the Worker entry cannot
  run `scripts/start.mjs`).

Commands:

```bash
bun run build:cloudflare
bunx wrangler deploy --config wrangler.jsonc
bun run test:cloudflare-runtime # local emulation only
```

The D1 schema bootstraps on first request. Run the common acceptance checks
against the deployed URL, then record the Worker deployment ID, D1 database
name, R2 bucket name, and test date.

## Vercel

Required before verification:

- A linked Vercel project and authenticated CLI.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, and `SHARE_SECRET` project
  secrets, plus `NUXT_APP_SECRET` derived from `JWT_SECRET`.
- A durable external database (not implemented in this repository yet).
- `STORAGE_DRIVER=s3` and all `S3_*` variables configured.

Commands:

```bash
bun run build:vercel
bunx vercel deploy --prebuilt
```

A successful Vercel build with ephemeral local filesystem storage is not
sufficient. Do not mark Vercel production-ready until a managed database adapter
and S3 storage are both verified remotely.

## Docker Engine

```bash
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD='choose-a-strong-password'
export JWT_SECRET="$(openssl rand -base64 32)"
export SHARE_SECRET="$(openssl rand -base64 32)"
docker compose up -d --build
curl -fsS http://localhost:3000/api/health
```

The named volume is mounted at `/data`. Verify it survives
`docker compose down` followed by `docker compose up -d` without deleting the
volume, and run `bun run test:docker` for the automated replacement check.

## InstaCloud

The InstaCloud deployment contract is not verified. Do not mark it supported
until the platform's current Docker/template documentation or an official
emulator is available and the common acceptance checks pass with persistent
`/data` storage. Record the platform template URL and deployment ID before
changing the status in `verification-matrix.md`.
