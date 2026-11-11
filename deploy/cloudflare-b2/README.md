# Serangkai on Cloudflare Workers + Backblaze B2

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-b2)

This directory is a thin deployment template: Serangkai on Cloudflare Workers
with **D1** for data and **Backblaze B2** for object storage. It provisions no
R2 bucket and needs no R2 activation or billing card — D1 and the free B2 tier
are enough for a personal instance. The free tier includes 10 GB of storage,
free egress up to 3× average monthly stored data, and the first 2,500 Class D
downloads per day; heavier use is billed.

## Why this template exists

The Deploy to Cloudflare button reads one Wrangler configuration per repository,
and a subdirectory URL is treated as a standalone repository root with all of
its dependencies inside it. The application source is therefore fetched at
build time by `build.mjs` (default branch, or pin `SERANGKAI_REF`) instead of
being copied here, so there is still exactly one copy of the code.

`build.mjs` downloads `sewadahapp/serangkai@master` by default. Set
`SERANGKAI_REF` to a tag or commit for a reproducible deploy, and
`SERANGKAI_REPO` to build a fork. Editing the cloned template changes only the
launcher (Wrangler config and build script), not the application; make
application changes upstream and redeploy.

The R2 one-click flow lives at the repository root and is unchanged.

## Before you click

Create, in Backblaze:

1. A **private** bucket (any region).
2. A **bucket-scoped application key** with read, write, delete, and list
   permissions for that bucket. Do not use the account master key.
3. A **lifecycle rule** with an empty file prefix that keeps only the last
   version of each file. B2 keeps replaced versions by default, and hidden
   versions count toward storage. In the console choose **Keep only the last
   version of the file**, or set **Days from hiding to deleting** to `1` and
   leave **Days from uploading to hiding** empty — the upload-to-hiding value
   would hide the current version too. Rules run once per day.

From the bucket's details note the S3 endpoint (`https://s3.<region>.backblazeb2.com`)
and the region (`<region>`, for example `us-west-004`).

The button then prompts for the owner credentials, session secrets, and the
five `S3_*` values listed in `.dev.vars.example`.

## Local rehearsal

```bash
# From this directory: fetch and build the app source
npm run build             # or: SERANGKAI_LOCAL_SOURCE=/path/to/checkout npm run build

# Deploy with a D1 database you created first:
#   npx wrangler@4 d1 create serangkai
# Paste the returned database_id into wrangler.jsonc, then:
npx wrangler@4 deploy
```

Set the secrets once with `npx wrangler@4 secret put NAME`.

## What is verified

The Worker build, the S3 adapter (including SigV4 signing against a
Backblaze-compatible mock), binary integrity, and D1 + B2 persistence across a
Worker restart are exercised locally by `bun test tests/cloudflare-s3-runtime.test.mjs`.
The hosted button flow itself has not been run against a real Cloudflare
account and Backblaze bucket in this repository; treat first-time deployment as
something to verify, not a supported contract.
