# Remote deployment verification runbook

This runbook is intentionally procedural. Completing a local build or dry-run
does not make a provider deployment verified.

If credentials or a provider environment are unavailable, use
`npm run test:provider-local` and record the target as **not deployed** rather
than attempting to infer remote support from local output.

## Common acceptance checks

For every provider, record the date, deployment URL, image/build identifier,
runtime version, and result for:

1. `/api/health` returns `200` and `{ "status": "ok" }`.
2. Registration and login work.
3. A private Markdown artifact can be created, read, and updated.
4. A public artifact is shareable while a private artifact is denied anonymously.
5. An unlisted artifact requires its signed capability link.
6. A binary upload can be downloaded unchanged.
7. Restart/redeploy preserves the user and artifact when durable storage is
   configured.
8. Logs contain no secrets or password material.

## Cloudflare Workers + D1 + R2

Required before verification:

- A Cloudflare account and Wrangler authentication.
- A real D1 database bound as `DB`.
- D1 migrations applied to that database.
- A real R2 bucket bound as `ARTIFACTS`.
- `JWT_SECRET` and `SHARE_SECRET` set with `wrangler secret put`.

Commands:

```bash
npm run build:cloudflare
npx wrangler d1 migrations apply serangkai --remote
npx wrangler deploy --config wrangler.jsonc
npm run test:cloudflare-runtime # local emulation only
```

Run the common acceptance checks against the deployed URL, then record the
Worker deployment ID, D1 database name, R2 bucket name, and migration revision.

## Vercel

Required before verification:

- A linked Vercel project and authenticated CLI.
- `JWT_SECRET` and `SHARE_SECRET` project secrets.
- A durable external database and S3-compatible object store.
- `STORAGE_DRIVER=s3` and all `S3_*` variables configured.

Commands:

```bash
npm run build:vercel
npx vercel deploy --prebuilt
```

Run the common acceptance checks against the deployment URL. A successful
Vercel build with ephemeral local filesystem storage is not sufficient.

## Docker Engine

```bash
export JWT_SECRET="$(openssl rand -base64 32)"
export SHARE_SECRET="$(openssl rand -base64 32)"
docker compose up -d --build
curl -fsS http://localhost:3000/api/health
```

Verify the named volume survives `docker compose down` followed by
`docker compose up -d` without deleting the volume.

## InstaCloud

The InstaCloud deployment contract is not verified. Do not mark it supported
until the platform's current Docker/template documentation or an official
emulator is available and the common acceptance checks pass with persistent
`/app/data` storage. Record the platform template URL and deployment ID before
changing the status in `verification-matrix.md`.
