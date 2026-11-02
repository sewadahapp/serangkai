# Cloudflare Workers deployment

Nitro documents `cloudflare_module` as the current Cloudflare Workers preset.
Build locally with:

```bash
npm run build:cloudflare
wrangler dev
wrangler deploy
```

`wrangler.jsonc` enables `nodejs_compat` for the current server dependencies.
Set `JWT_SECRET` and `SHARE_SECRET` with `wrangler secret put` and never commit
them to the configuration file.

## Storage limitation

The default Serangkai adapter uses `better-sqlite3` and local filesystem storage,
which are Node/container adapters and are not portable to Workers. Object storage
can use `STORAGE_DRIVER=r2-binding` with an R2 binding named by `R2_BINDING`, or
the S3-compatible adapter with R2 credentials. A Cloudflare deployment still
requires a D1-compatible database adapter before it can be considered fully
production-supported. This repository verifies the Nitro preset and object
storage adapter contracts, not the default SQLite/filesystem data layer in
Workers.
