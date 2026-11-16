# Serangkai on Cloudflare Workers + Turso

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-turso)

This template runs Serangkai on Cloudflare Workers with **Turso/libSQL** for
metadata, users, and tokens, and **R2** for rangka content and uploaded files.
The button provisions the R2 bucket and prompts for the secrets in
`.dev.vars.example`. It does not create a D1 database.

## Before deploying

1. Create a Turso/libSQL database in your Turso account. Copy its `libsql://`
   URL and create a **read/write database token**, rather than a platform API
   token. See [Turso's TypeScript quickstart](https://docs.turso.tech/sdk/ts/quickstart).
2. Enable R2 in your Cloudflare account. This template requires R2 for files.
3. Choose an owner username and strong password. Generate three separate
   random secrets with `openssl rand -base64 32` for `JWT_SECRET`,
   `SHARE_SECRET`, and `NUXT_APP_SECRET`.

Click the button and enter those values when prompted. Keep the secrets stable
across redeployments. The deploy command builds the Cloudflare Worker with Bun
and deploys it using this directory's Wrangler configuration. A separate build
command can be left blank because the deploy script runs the build itself.

The Worker initializes the shared SQLite schema and upgrade migrations on the
first database request. A successful login and a rangka write verify both the
database and object store; the health endpoint alone checks neither.

Existing SQLite or D1 data is not transferred automatically. Import the
database into Turso explicitly and preserve the corresponding files and stable
secrets before switching an existing workspace.

## Source version and upgrades

Cloudflare copies this subdirectory as a standalone repository, so `build.mjs`
downloads the application source rather than depending on parent directories.
It resolves `SERANGKAI_REF` first, then the immutable commit in `serangkai.ref`,
then `master` if no pin exists. The shipped pin includes Turso support.
`.output/serangkai-source.json` records the source ref for each build.

To upgrade, update `serangkai.ref` to the desired release tag or commit and
redeploy. Set `SERANGKAI_REPO` to build a fork, or
`SERANGKAI_LOCAL_SOURCE=/path/to/checkout` to rehearse local changes. Editing
the cloned launcher does not change the application source it downloads.

## Local rehearsal

```bash
# From this directory, with Bun 1.4+ installed:
bun run build
# Or build a local checkout:
SERANGKAI_LOCAL_SOURCE=/path/to/serangkai bun run build

# Copy .dev.vars.example to .dev.vars and replace its placeholders, then:
bunx --bun wrangler@4.156.1 dev --local
```

For manual deployment, create an R2 bucket with
`bunx --bun wrangler@4.156.1 r2 bucket create serangkai`, add its `bucket_name`
to `wrangler.jsonc`, and set each Worker secret with
`bunx --bun wrangler@4.156.1 secret put NAME`. Then run `bun run deploy`.
From the full application repository, use `wrangler.turso.jsonc` and
`bun run deploy:turso` instead.

Local development connects to the configured Turso database; use a separate
development database to keep test writes out of your workspace.

## Verification

The local Worker test covers login, remote SQL, R2 content, and binary upload
and download with no D1 binding. It uses the production libSQL HTTP client
against a local SQLite-backed Hrana fixture. The hosted button flow and a real
Turso account still require deployment verification.
