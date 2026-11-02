# Deployment verification matrix

This matrix distinguishes local build/runtime evidence from real provider
deployment evidence. A passing local test is not a claim that a remote provider
deployment is supported.

| Target | Local evidence | Real deployment | Boundary |
| --- | --- | --- | --- |
| Docker-compatible container | Podman image build, health, registration, restart persistence | Docker Engine unavailable here | Docker Engine and registry-host verification remain separate |
| Cloudflare Workers + D1 | Nitro build and Wrangler/Miniflare registration/artifact/listing pass | Not deployed | Requires real D1 secrets, migrations, and production config |
| Cloudflare R2 | Mocked request-scoped binding and binary adapter tests pass | Not deployed | Requires a real R2 bucket/binding and durable object verification |
| Vercel | Nitro preset build and local Node runtime registration/listing pass | Not deployed | Requires Vercel project, secrets, and durable external storage |
| InstaCloud | Generic Docker checklist only | Not verified | Requires platform documentation/account or official emulator |

## Current commands

```bash
npm run test:database
npm run test:r2
npm run test:r2-request
npm run test:local-runtime
npm run test:cloudflare-runtime
npm run test:vercel-runtime
```

No command in this matrix deploys to a remote service or incurs provider cost.

## Remote deployment boundary

The project intentionally does not claim that Docker, Cloudflare, Vercel,
Cloudflare R2, or InstaCloud have been deployed remotely from this repository.
Those checks require provider credentials, a real account, and durable-resource
configuration. The local matrix is the reproducible evidence available without
secrets or paid services.
