# Cloudflare Workers deployment

Serangkai uses Nitro's `cloudflare_module` preset, a request-scoped Drizzle D1
adapter, and a native R2 binding for artifact storage.

```bash
bun run build:cloudflare
bunx wrangler dev
bunx wrangler deploy
```

## Bindings and secrets

`wrangler.jsonc` declares:

- D1 binding `DB`
- R2 binding `ARTIFACTS`
- `nodejs_compat`

`ARTIFACTS` is mandatory. If the binding is missing, startup fails with a clear
error instead of falling back to in-memory storage. That fallback is only
available when `SERANGKAI_ALLOW_EPHEMERAL_STORAGE=true` is set **and** the app
is not running in production; never set it on a deployed Worker, where every
artifact would disappear at the end of the isolate.

Set production secrets with Wrangler; never commit them to the config file:

```bash
bunx wrangler secret put JWT_SECRET
bunx wrangler secret put SHARE_SECRET
bunx wrangler secret put ADMIN_USERNAME
bunx wrangler secret put ADMIN_PASSWORD
# Edge entry points cannot be wrapped by scripts/start.mjs, so set the
# session secret explicitly. Derive it from the same JWT_SECRET:
bunx wrangler secret put NUXT_APP_SECRET
#   value: bun scripts/derive-session-secret.mjs "$JWT_SECRET"
```

The app validates the four owner/session values at startup in production and
refuses to serve with development defaults. Registration is disabled; the owner
account comes from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Schema

The D1 adapter applies the shared bootstrap statements on the first request in
an isolate (`server/db/bootstrap.ts`). This keeps local Miniflare and fresh
deployments usable without a separate migration step. Generated Drizzle
migrations remain the recommended hardening path for schema changes once the
schema stabilizes.

## Local verification

```bash
bun run test:cloudflare-runtime
```

This builds the Worker with Bun, starts Wrangler/Miniflare with local D1 and R2
bindings, and verifies:

- owner login and token creation
- Markdown artifact creation and listing
- binary image upload and byte-for-byte download through R2
- no fallback to ephemeral memory storage

The test deliberately does **not** set `SERANGKAI_ALLOW_EPHEMERAL_STORAGE`; if
the R2 binding ever regresses the run fails instead of passing on memory.

The local test is not a remote deployment. A real Cloudflare deployment still
requires a real D1 database, an R2 bucket, and production secrets. Record the
Worker deployment ID, D1 database name, R2 bucket name, and test date in
`verification-matrix.md` after running the common acceptance checks.
