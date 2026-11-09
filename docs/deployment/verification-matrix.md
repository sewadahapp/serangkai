# Deployment verification matrix

This matrix distinguishes local build/runtime evidence from real provider
deployment evidence. A passing local test is not a claim that a remote provider
deployment is supported.

| Target | Local evidence | Real deployment | Boundary |
| --- | --- | --- | --- |
| Docker-compatible container | Podman build of the Bun image; health, owner login, artifact/upload/token/share persistence across container replacement on `/data` | Docker Engine unavailable here | Docker Engine, registry publishing, and host verification remain separate |
| Cloudflare Workers + D1 | Nitro build and Wrangler/Miniflare owner login, artifact creation, and listing pass | Not deployed | Requires real D1 database, secrets, and production config |
| Cloudflare R2 | Local Wrangler R2 binding: binary upload/download byte-for-byte; no memory fallback | Not deployed | Requires a real R2 bucket and durable object verification |
| Vercel | Nitro Build Output and local Node runtime owner login/artifact/listing pass | Not deployed | Requires a Vercel project, secrets, durable external database, and S3 storage |
| InstaCloud | Generic Docker checklist and image run path only | Not verified | Requires platform documentation/account or official emulator |

The Wrangler `deploy --dry-run` check also passes locally and validates the
generated Worker bundle and checked-in D1/R2 bindings without uploading or
requiring Cloudflare credentials. This is build validation, not a remote
deployment.

One thing the dry run does **not** prove: whether static assets are uploaded.
`wrangler.jsonc` previously lacked an `assets` block, so `wrangler deploy` would
have shipped the Worker without `/_nuxt`; the dry run reported a healthy bundle
either way. The block is now checked in and guarded by
`tests/deployment-files.test.mjs`, and a real deploy log should say
`Read N files from the assets directory`.

## Current commands

```bash
bun run test:config
bun run test:database
bun run test:local-runtime
bun run test:cloudflare-runtime
bun run test:vercel-runtime
```

No command in this matrix deploys to a remote service or incurs provider cost.

Credential-free checks also validate Docker Compose secret interpolation and
deployment-file invariants. These checks do not create remote resources.

## Remote deployment boundary

The project intentionally does not claim that Docker, Cloudflare, Vercel,
Cloudflare R2, or InstaCloud have been deployed remotely from this repository.
Those checks require provider credentials, a real account, and durable-resource
configuration. The local matrix is the reproducible evidence available without
secrets or paid services.
