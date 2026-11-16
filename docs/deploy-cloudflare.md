# Choose providers and deploy

Choose a database and a place to store rangka content and uploaded files.
Each **Deploy** link opens Cloudflare with exactly that combination. There is
no preselected combination; this page creates no resources and collects no
credentials.

| Database | File storage | Cloudflare data resources provisioned | Continue |
| --- | --- | --- | --- |
| D1 | R2 | D1 database + R2 bucket | [Deploy D1 + R2](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai) |
| D1 | Backblaze B2 | D1 database | [Deploy D1 + B2](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-b2) |
| Turso | R2 | R2 bucket | [Deploy Turso + R2](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-turso) |
| Turso | Backblaze B2 | None | [Deploy Turso + B2](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-turso-b2) |

**Turso + B2 requires neither a D1 nor an R2 binding.** Every combination still
runs the application and serves its static assets on Cloudflare Workers.
External services are created in their own accounts before deploying.

## Prepare your selected providers

**D1:** Cloudflare provisions the database during setup. The Worker creates
its schema on the first database request; no separate migration command is
needed.

**Turso:** Create a Turso/libSQL database and a read/write **database token**.
Copy its `libsql://` URL and token for the `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN` prompts. A platform API token is different and should not be
used here. See [Turso's quickstart](https://docs.turso.tech/sdk/ts/quickstart).

**R2:** Enable R2 in your Cloudflare account. The selected template provisions
and binds a bucket. R2 is only requested by the two R2 choices.

**Backblaze B2:** Create a private bucket and a bucket-scoped application key
with read, write, delete, and list permissions. Note the full S3 endpoint
(`https://s3.<region>.backblazeb2.com`), region, bucket name, key ID, and
application key. They become `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. B2 choices require no R2
activation. Keep the bucket private and use an application key scoped to that
bucket.

B2 retains old object versions by default. Set a lifecycle rule with an empty
file prefix to keep only the last version: use **Keep only the last version of
the file**, or set **Days from hiding to deleting** to `1` and leave **Days from
uploading to hiding** empty. Setting an upload-to-hiding age would hide current files too.
Lifecycle rules run daily, so replaced versions can temporarily count toward
storage. Provider usage limits and billing still apply.

## Complete the Cloudflare setup

Every combination prompts for these five owner/session values:

- `ADMIN_USERNAME` and a strong `ADMIN_PASSWORD`.
- `JWT_SECRET`, `SHARE_SECRET`, and `NUXT_APP_SECRET`: generate each separately
  with `openssl rand -base64 32` and keep them stable across redeployments.

Workers cannot run `scripts/start.mjs` to derive the session key, so
`NUXT_APP_SECRET` must be supplied explicitly. Each template's
`.dev.vars.example` adds only the credentials for its chosen external
providers. Enter secrets on Cloudflare's setup page, never in this chooser or
in committed configuration files.

The deploy script builds the `cloudflare_module` preset with Bun before running
Wrangler. If Cloudflare pre-populates a separate build command, it may be left
blank because the deploy script performs the build itself. After deployment,
verify owner login, a rangka write, and an upload/download. The health endpoint
alone checks neither database nor file storage.

## Manual deployments

Run the matching command from the full repository. Create the selected D1/R2
resources first and add their `database_id`/`bucket_name` to that configuration
when deploying manually.

| Database + storage | Wrangler configuration | Command |
| --- | --- | --- |
| D1 + R2 | [`wrangler.jsonc`](../wrangler.jsonc) | `bun run deploy` |
| D1 + B2 | [`wrangler.b2.jsonc`](../wrangler.b2.jsonc) | `bun run deploy:b2` |
| Turso + R2 | [`wrangler.turso.jsonc`](../wrangler.turso.jsonc) | `bun run deploy:turso` |
| Turso + B2 | [`wrangler.turso-b2.jsonc`](../wrangler.turso-b2.jsonc) | `bun run deploy:turso-b2` |

Set each required Worker secret with
`bunx --bun wrangler secret put NAME --config <chosen-config>` before deploying.
Switching providers does not move your data: import the database explicitly,
copy the corresponding content/files, and retain the stable secrets. See the
[Turso adapter notes](../README.md#turso--remote-libsql).

## How the chooser works

Cloudflare's native button reads one Wrangler configuration and secret list.
Its [documented setup flow](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
does not describe conditional provider selectors. This chooser therefore
routes to four fixed configurations so unselected resources and credential
prompts are omitted. It is a GitHub document and requires no separate hosting.

The D1 + R2 choice clones the full repository. Other choices use standalone
launchers under `deploy/`, since Cloudflare copies a subdirectory as the new
repository root. These launchers download a pinned application commit and
record it in `.output/serangkai-source.json`. To upgrade, edit `serangkai.ref`
or explicitly set `SERANGKAI_REF` and redeploy. `SERANGKAI_REPO` selects a fork;
`SERANGKAI_LOCAL_SOURCE` builds a local checkout for rehearsals.

Local tests use the real Workers runtime with SQLite-backed libSQL and signed
S3 fixtures. Hosted button flows and real provider accounts still need
deployment verification. The public links require these templates and their
pinned application commits to be available on the repository's `master` branch.
