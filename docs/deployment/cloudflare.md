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

The repository now includes a request-scoped Drizzle D1 adapter and bootstrap
schema helper. Set `DATABASE_DRIVER=d1` in provider configuration and pass the
Cloudflare `env.DB` binding to `createD1Database()`. Route migration to this
request-scoped database is still required before enabling the complete app on
Workers; local SQLite remains the default Node/container path.

The local runtime integration test uses Wrangler/Miniflare with the checked-in
`DB` binding configuration:

```bash
npm run test:cloudflare-runtime
```

It verifies registration, artifact creation, and artifact listing through the
actual local Worker request path. A remote Cloudflare deployment still requires
creating a real D1 database, applying migrations, and setting production
secrets; no remote account is required or used by the test.

The local preview edge storage adapter uses isolate memory only so the runtime
test can exercise artifact creation without an R2 account. It is not durable and
must be replaced with the R2 binding adapter for production.

The local runtime test currently exposes a remaining portability blocker when
the bundled Node-only SQLite dependency is present in the Worker graph. Nitro's
Cloudflare build succeeds, but the Worker runtime test must remain green before
Cloudflare D1 can be called production-ready; use the test failure output to
guide any future bundler/externalization changes.

Current observed Wrangler/Miniflare failure (2026-11-02): Worker startup aborts
before the first request with `The "superCtor.prototype" property must be of
type object. Received undefined` from a bundled Node compatibility dependency.
The generated bundle still contains Node built-ins from the default SQLite and
local-file adapters. A computed dynamic import removes that dependency from the
Worker graph but breaks Nitro's prerender phase, so it is not being used as a
false fix. The test remains intentionally failing until a proper Nitro
provider-specific build split is implemented.
