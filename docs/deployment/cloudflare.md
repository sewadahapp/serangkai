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
which are Node/container adapters and are not portable to Workers. A Cloudflare
deployment requires a D1/R2 storage adapter before it can be considered
production-supported. This repository verifies the Nitro preset configuration,
not a claim that the default SQLite/filesystem data layer works in Workers.
