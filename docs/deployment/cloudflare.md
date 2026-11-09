# Cloudflare Workers deployment

Serangkai uses Nitro's `cloudflare_module` preset, a request-scoped Drizzle D1
adapter, and a native R2 binding for artifact storage.

This is the shortest path from a checkout to a running Worker. It needs a
Cloudflare account and `wrangler login`; nothing else.

```bash
bunx wrangler login
bun run build:cloudflare
bunx wrangler deploy
```

That only works after the one-time resource setup below — the checked-in
`wrangler.jsonc` ships placeholder D1 ids that a real deploy will reject.

## One-time setup

1. **Create the database and bucket.**

   ```bash
   bunx wrangler d1 create serangkai
   bunx wrangler r2 bucket create serangkai-artifacts
   ```

2. **Put the returned `database_id` into `wrangler.jsonc`**, and set
   `database_name` to the name you chose. Keep the binding names `DB` and
   `ARTIFACTS` exactly as they are; the runtime looks them up by name.

   ```jsonc
   "d1_databases": [
     { "binding": "DB", "database_name": "serangkai", "database_id": "<uuid from step 1>" }
   ]
   ```

3. **Set the production secrets.** These are not in the config file and must
   never be committed:

   ```bash
   bunx wrangler secret put ADMIN_USERNAME
   bunx wrangler secret put ADMIN_PASSWORD
   bunx wrangler secret put JWT_SECRET          # openssl rand -base64 32
   bunx wrangler secret put SHARE_SECRET        # openssl rand -base64 32
   bunx wrangler secret put NUXT_APP_SECRET     # derived from JWT_SECRET, below
   ```

   Edge entry points cannot be wrapped by `scripts/start.mjs`, so the session
   key has to be set explicitly rather than derived at boot:

   ```bash
   bun scripts/derive-session-secret.mjs "$JWT_SECRET"
   ```

   Use a single-line value; `wrangler secret put` reads one value per prompt.

4. **Schema.** The D1 adapter applies the shared bootstrap statements on the
   first request in an isolate (`server/db/bootstrap.ts`), so a fresh database
   needs no separate migration step. An existing database gains the OAuth
   tables through `ensureOAuthSchema`, which is additive.

5. **Deploy.**

   ```bash
   bun run build:cloudflare && bunx wrangler deploy
   ```

## Bindings and secrets

`wrangler.jsonc` declares:

- D1 binding `DB`
- R2 binding `ARTIFACTS`
- `ASSETS` for the static client bundle (`.output/public`)
- `nodejs_compat`

The `assets` block is easy to miss and its absence is silent: Nitro's preset
would generate an equivalent binding, but this checked-in file wins, so without
it `wrangler deploy` uploads the Worker alone and every `/_nuxt` request 404s.
`wrangler deploy --dry-run` does not catch that — it reports the Worker bundle,
not the asset count. Confirm the deploy log says `Read N files from the assets
directory`, and `tests/deployment-files.test.mjs` guards the block.

`ARTIFACTS` is mandatory. If the binding is missing, startup fails with a clear
error instead of falling back to in-memory storage. That fallback is only
available when `SERANGKAI_ALLOW_EPHEMERAL_STORAGE=true` is set **and** the app
is not running in production; never set it on a deployed Worker, where every
artifact would disappear at the end of the isolate.

The app validates the four owner/session values at startup in production and
refuses to serve with development defaults. Registration is disabled; the owner
account comes from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Agent connections (OAuth)

OAuth works on Workers without extra configuration: discovery is derived from
the request origin, which Cloudflare supplies as your `*.workers.dev` hostname
or custom domain. Two notes:

- The rate limiter is per isolate. It bounds a single Worker instance rather
  than the whole deployment, so it raises the cost of a flood without acting as
  a global ceiling.
- Serve the Worker over HTTPS (the default). OAuth clients reject plain HTTP
  except on loopback.

## Custom domain

Add the route in the dashboard, or in `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "artifacts.example.com", "custom_domain": true }]
```

If you put another proxy in front and it rewrites `Host` without forwarding the
original, set `PUBLIC_BASE_URL` to the public origin so OAuth discovery and
share links advertise the address clients actually use.

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
requires a real D1 database, an R2 bucket, and production secrets. After doing
one, record the Worker deployment ID, D1 database name, R2 bucket name, and test
date in `verification-matrix.md` after running the common acceptance checks.

## Cost and limits

The Workers free tier includes D1 and R2 with daily request/storage allowances;
a single-owner workspace typically stays inside them. The Worker bundle is about
14 MB raw (2.6 MB gzipped), within the Workers limit. R2 has no egress fees,
which matters because artifact reads are the main traffic.
