# Deployment documentation

Serangkai supports a simple Node/container deployment by default and includes
portable provider presets. The status below is intentionally conservative.

| Provider | Local verification | Remote status |
| --- | --- | --- |
| Docker-compatible container | Podman image build, health, registration, restart persistence | Docker Engine not run here |
| Cloudflare Workers | Nitro build, Wrangler dry-run, Miniflare D1 registration/artifact/listing | Not deployed remotely |
| Cloudflare R2 | Request-scoped mock binding and binary adapter tests | Real R2 not deployed |
| Vercel | Nitro Build Output and local Node runtime registration/artifact/listing | Not deployed remotely |
| InstaCloud | Generic container checklist | **Not verified** |

## Before claiming a provider is verified

Use a real provider account or official local emulator, configure durable storage,
run the health/auth/artifact/restart workflow, and record the result in
`verification-matrix.md`. Do not commit credentials, production URLs, or provider
state into this repository.

See the provider-specific documents:

- [Docker](./docker.md)
- [Cloudflare Workers and D1/R2](./cloudflare.md)
- [Vercel](./vercel.md)
- [InstaCloud](./instacloud.md)
- [Verification matrix](./verification-matrix.md)
- [Remote verification runbook](./remote-verification-runbook.md)

## Container image

Any provider that runs a Docker image can host Serangkai: the image exposes port
`3000`, stores runtime state under `/app/data`, and needs `JWT_SECRET` and
`SHARE_SECRET`. Tagged releases publish multi-arch images to GHCR through
`.github/workflows/docker.yml`. See [InstaCloud](./instacloud.md) for the
generic image checklist; that provider remains **Not verified** until tested
against a real account.

## Credential-free local verification

Run the complete local/emulated provider suite with:

```bash
npm run test:provider-local
```

This covers SQLite, D1/Miniflare, mocked/request-scoped R2, and the local
Vercel-compatible Node runtime. It does not deploy to or authenticate with a
remote provider.
