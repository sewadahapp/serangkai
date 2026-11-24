---
title: Cloudflare Workers
description: Deploy to Cloudflare with D1 or Turso, and R2 or Backblaze B2.
order: 2
---

# Cloudflare Workers

Serangkai runs on Cloudflare Workers from **your own fork** of the repository.
Cloudflare builds the fork, and you update by syncing it on GitHub. You need a
GitHub account and a Cloudflare account; no terminal is required.

## Choose a combination

| Database | File storage | Deploy command | Created on first deploy |
| --- | --- | --- | --- |
| D1 | R2 | `bun run deploy` | D1 database and R2 bucket |
| D1 | Backblaze B2 | `bun run deploy:b2` | D1 database |
| Turso | R2 | `bun run deploy:turso` | R2 bucket |
| Turso | Backblaze B2 | `bun run deploy:turso-b2` | Nothing |

D1 + R2 keeps everything inside Cloudflare and is the simplest choice. R2 must
be enabled once in your Cloudflare account, which asks for a payment method
even on the free tier.

## Prepare outside providers

Skip this for D1 + R2.

- **Turso**: create a database and a read/write **database token** (not a
  platform API token). Keep its `libsql://` URL and the token.
- **Backblaze B2**: create a private bucket and an application key scoped to it
  with read, write, delete, and list permissions. Note the S3 endpoint
  (`https://s3.<region>.backblazeb2.com`), region, bucket, key ID, and key.

::SCallout{type="warning" title="Backblaze keeps old file versions"}
B2 retains replaced objects by default. Add a lifecycle rule with an empty
prefix that keeps only the last version, or replaced files keep counting toward
your B2 storage.
::

## Fork and import

1. Open [sewadahapp/serangkai](https://github.com/sewadahapp/serangkai), click
   **Fork**, and keep the name `serangkai`.
2. In Cloudflare, open **Workers & Pages → Create → Import a repository** and
   pick your fork.
3. Keep the project name **`serangkai`**.
4. Leave the build command empty, set the deploy command from the table above,
   and turn preview builds off. Preview builds would run other branches against
   your real data.
5. Deploy. The first deploy creates the database and bucket your combination
   needs; later deploys reuse them.

## Add the secrets

In the Worker, open **Settings → Variables and Secrets** and add each value as
a **Secret**. Saving a secret applies it right away.

- `ADMIN_USERNAME` and a strong `ADMIN_PASSWORD` (at least 8 characters)
- `JWT_SECRET`, `SHARE_SECRET`, and `NUXT_APP_SECRET`: three different random
  values from a password manager's generator (32+ characters) or
  `openssl rand -base64 32`
- Turso only: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- B2 only: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and
  `S3_SECRET_ACCESS_KEY`

Keep the random values stable. Changing `JWT_SECRET` or `NUXT_APP_SECRET` signs
everyone out, and changing `SHARE_SECRET` breaks existing share links.

## Check it works

Sign in, create a rangka, and upload a file. The health endpoint alone checks
neither the database nor file storage.

## Updating

Open your fork on GitHub and click **Sync fork → Update branch**. Cloudflare
redeploys with the new version; your data, secrets, and domain stay as they
are.

## Moving from a Deploy button copy

Earlier versions used Cloudflare's Deploy button, which copies the repository
instead of forking it, so the copy never receives updates. To switch:

1. Rename your copy on GitHub (for example to `serangkai-old`), then fork
   Serangkai as `serangkai`.
2. In the Worker, open **Settings → Build**, click **Disconnect**, then
   **Connect** your fork.
3. Set the build settings as above. B2 and Turso copies use their `deploy:*`
   command.
4. Sync or redeploy, check your rangka and files are there, then delete the old
   copy.

The Worker keeps its secrets, domain, database, and bucket.

## Deploy from a terminal

From a clone of the repository, set each secret with
`bunx --bun wrangler secret put NAME --config <config>`, then run:

| Combination | Configuration | Command |
| --- | --- | --- |
| D1 + R2 | `wrangler.jsonc` | `bun run deploy` |
| D1 + B2 | `wrangler.b2.jsonc` | `bun run deploy:b2` |
| Turso + R2 | `wrangler.turso.jsonc` | `bun run deploy:turso` |
| Turso + B2 | `wrangler.turso-b2.jsonc` | `bun run deploy:turso-b2` |
