# Deploy to Cloudflare

Serangkai runs on Cloudflare Workers from **your own fork** of this repository.
Cloudflare builds the fork, and you get updates by syncing it: one click on
GitHub, then Cloudflare redeploys by itself.

You need a GitHub account and a Cloudflare account. No terminal is required.

## 1. Choose a database and file storage

| Database | File storage | Deploy command | Cloudflare creates on first deploy |
| --- | --- | --- | --- |
| D1 | R2 | `bun run deploy` | D1 database + R2 bucket |
| D1 | Backblaze B2 | `bun run deploy:b2` | D1 database |
| Turso | R2 | `bun run deploy:turso` | R2 bucket |
| Turso | Backblaze B2 | `bun run deploy:turso-b2` | Nothing |

**D1 + R2** keeps everything inside Cloudflare and is the simplest choice. R2
needs to be enabled once in your Cloudflare account, which asks for a payment
method even on the free tier. If you would rather not, choose **D1 + B2**.

The deploy command picks the matching Wrangler configuration, so the rest of
this guide is the same for every combination.

## 2. Prepare outside providers

Skip this step for D1 + R2.

**Turso:** Create a Turso/libSQL database and a read/write **database token**.
Keep its `libsql://` URL and the token for `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN`. A platform API token is different and does not work here.
See [Turso's quickstart](https://docs.turso.tech/sdk/ts/quickstart).

**Backblaze B2:** Create a private bucket and a bucket-scoped application key
with read, write, delete, and list permissions. Keep the full S3 endpoint
(`https://s3.<region>.backblazeb2.com`), the region, the bucket name, the key
ID, and the application key. They become `S3_ENDPOINT`, `S3_REGION`,
`S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`.

B2 keeps old file versions by default. Add a lifecycle rule with an empty file
prefix that keeps only the last version: use **Keep only the last version of the
file**, or set **Days from hiding to deleting** to `1` and leave **Days from
uploading to hiding** empty. Setting an upload-to-hiding age would hide current
files too. Lifecycle rules run daily, so replaced versions can count toward
storage for a day.

## 3. Fork the repository

Open [sewadahapp/serangkai](https://github.com/sewadahapp/serangkai), click
**Fork**, and keep the name `serangkai`.

## 4. Import the fork into Cloudflare

1. In the Cloudflare dashboard, open **Workers & Pages → Create → Import a
   repository**. Connect GitHub if asked, and allow access to the fork.
2. Pick your fork.
3. Keep the project name **`serangkai`**. It must match the name in the
   Wrangler configuration.
4. Set the build settings:

   | Setting | Value |
   | --- | --- |
   | Build command | leave empty |
   | Deploy command | the command from step 1, for example `bun run deploy` |
   | Root directory | `/` |
   | Preview builds | off |

   The deploy command builds Serangkai for Workers and then deploys it, so no
   separate build command is needed. Keep preview builds off: they would run
   other branches against your real database and files.
5. Deploy.

The first deploy creates the D1 database and R2 bucket your combination needs.
Later deploys reuse them.

## 5. Add the secrets

Open the Worker, go to **Settings → Variables and Secrets**, and add each value
below as type **Secret**. Saving a secret applies it right away, without a
rebuild. Serangkai cannot sign you in until the first five are set.

| Secret | Value |
| --- | --- |
| `ADMIN_USERNAME` | Your login name |
| `ADMIN_PASSWORD` | A strong password, at least 8 characters |
| `JWT_SECRET` | A random value |
| `SHARE_SECRET` | A different random value |
| `NUXT_APP_SECRET` | A different random value |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Turso choices only, from step 2 |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | B2 choices only, from step 2 |

For each random value, use your password manager's generator with 32 or more
characters, or run `openssl rand -base64 32`. Use a different value for each
one and never change them later: changing `JWT_SECRET` or `NUXT_APP_SECRET`
signs everyone out, and changing `SHARE_SECRET` breaks existing share links.

## 6. Check it works

Open the Worker's URL (or add a custom domain under **Settings → Domains &
Routes**), then sign in, create a rangka, and upload a file and download it
again. This checks the database and file storage; `/api/health` alone checks
neither.

## Updating

When Serangkai releases an update, open your fork on GitHub and click **Sync
fork → Update branch**. Cloudflare sees the new commit and redeploys. Your
data, secrets, and domain stay as they are.

Do not commit changes to your fork's `master` branch if you want syncing to
stay a single click.

## Moving from a Deploy to Cloudflare copy

Earlier versions of this guide used Cloudflare's Deploy button, which copies
the repository into your account instead of forking it, so it never receives
updates. To switch without losing data:

1. On GitHub, rename your copy (for example to `serangkai-old`), then fork
   [sewadahapp/serangkai](https://github.com/sewadahapp/serangkai) as
   `serangkai`.
2. In the Worker, open **Settings → Build**. Write down the current build
   settings, click **Disconnect**, then **Connect** your fork.
3. Set the build settings as in step 4. Copies made from the B2 or Turso
   buttons now use the matching `deploy:*` command from step 1.
4. Sync the fork or trigger a deploy, and check that your existing rangka and
   files are still there.
5. Delete the old copy once everything works.

The Worker keeps its secrets, domain, database, and bucket, because they
belong to the Worker rather than the repository.

## Deploying from a terminal

Run the matching command from a checkout of the repository:

| Database + storage | Wrangler configuration | Command |
| --- | --- | --- |
| D1 + R2 | [`wrangler.jsonc`](../wrangler.jsonc) | `bun run deploy` |
| D1 + B2 | [`wrangler.b2.jsonc`](../wrangler.b2.jsonc) | `bun run deploy:b2` |
| Turso + R2 | [`wrangler.turso.jsonc`](../wrangler.turso.jsonc) | `bun run deploy:turso` |
| Turso + B2 | [`wrangler.turso-b2.jsonc`](../wrangler.turso-b2.jsonc) | `bun run deploy:turso-b2` |

Set each secret with
`bunx --bun wrangler secret put NAME --config <chosen-config>`.
[`.dev.vars.example`](../.dev.vars.example) lists every secret.

Switching providers later does not move your data: import the database
explicitly, copy the files, and keep the same secrets. See the
[Turso adapter notes](../README.md#turso--remote-libsql).
