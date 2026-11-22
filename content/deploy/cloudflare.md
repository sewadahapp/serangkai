---
title: Cloudflare Workers
description: Deploy to Cloudflare with D1 or Turso, and R2 or Backblaze B2.
order: 2
---

# Cloudflare Workers

Choose a database and a place to store files. Each link opens Cloudflare's
deploy flow with exactly that combination, so only the resources you picked are
provisioned.

| Database | File storage | Cloudflare resources | Deploy |
| --- | --- | --- | --- |
| D1 | R2 | D1 database and R2 bucket | [Deploy D1 + R2](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai) |
| D1 | Backblaze B2 | D1 database | [Deploy D1 + B2](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-b2) |
| Turso | R2 | R2 bucket | [Deploy Turso + R2](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-turso) |
| Turso | Backblaze B2 | None | [Deploy Turso + B2](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-turso-b2) |

## Prepare your providers

- **D1**: provisioned during setup. The Worker creates its schema on the first
  request.
- **Turso**: create a database and a read/write **database token** (not a
  platform API token). You will be asked for its `libsql://` URL and the token.
- **R2**: enable R2 in your Cloudflare account; the template creates and binds a bucket.
- **Backblaze B2**: create a private bucket and an application key scoped to it
  with read, write, delete, and list permissions. Note the S3 endpoint
  (`https://s3.<region>.backblazeb2.com`), region, bucket, key ID, and key.

::SCallout{type="warning" title="Backblaze keeps old file versions"}
B2 retains replaced objects by default. Add a lifecycle rule with an empty
prefix that keeps only the last version, or replaced files keep counting toward
your B2 storage.
::

## Secrets

Every combination asks for five values. Generate each secret separately with
`openssl rand -base64 32` and keep them stable across redeployments:

- `ADMIN_USERNAME` and a strong `ADMIN_PASSWORD`
- `JWT_SECRET`, `SHARE_SECRET`, and `NUXT_APP_SECRET`

Workers cannot derive the session key from `JWT_SECRET` the way the Docker
image does, so `NUXT_APP_SECRET` is required here.

## After deploying

Sign in, create a rangka, and upload a file. The health endpoint alone checks
neither the database nor file storage.

## Deploy manually

From a clone of the repository, create the D1 and R2 resources you need, add
their IDs to the matching Wrangler configuration, set each secret with
`bunx --bun wrangler secret put NAME --config <config>`, then run:

| Combination | Configuration | Command |
| --- | --- | --- |
| D1 + R2 | `wrangler.jsonc` | `bun run deploy` |
| D1 + B2 | `wrangler.b2.jsonc` | `bun run deploy:b2` |
| Turso + R2 | `wrangler.turso.jsonc` | `bun run deploy:turso` |
| Turso + B2 | `wrangler.turso-b2.jsonc` | `bun run deploy:turso-b2` |
