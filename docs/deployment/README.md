# Deployment documentation

Serangkai supports a simple Bun/container deployment by default and includes
portable provider presets. The status below is intentionally conservative.

| Provider | Local verification | Remote status |
| --- | --- | --- |
| Docker-compatible container | Bun image build, health, owner login, artifact/upload/token/share persistence across container replacement on `/data` | Docker Engine not run here |
| Cloudflare Workers | Nitro build, Wrangler dry-run, Miniflare D1 + R2 owner login/artifact/binary upload/download | Not deployed remotely |
| Vercel | Nitro Build Output and local Node runtime owner login/artifact/listing | Not deployed remotely; durable database adapter still missing |
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
`3000`, stores runtime state under `/data`, and needs `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, and
`SHARE_SECRET`. The runtime is Bun 1.4 running Nitro's node-server output.
Tagged releases publish multi-arch images to GHCR through
`.github/workflows/docker.yml`. See [InstaCloud](./instacloud.md) for the
generic image checklist; that provider remains **Not verified** until tested
against a real account.

## Agent connections over OAuth

Serangkai is its own OAuth authorization server, so MCP clients can connect with
a browser approval. Two deployment facts follow from that:

- **Serve over HTTPS.** MCP clients reject a plain-HTTP server except on
  loopback. A `http://` LAN or IP-only deployment will work for the web UI and
  bearer tokens, but an OAuth-capable client will refuse it. Terminate TLS in
  front of the container.
- **`PUBLIC_BASE_URL` is the proxy escape hatch.** Every OAuth document and
  redirect is built from the incoming request, honoring `X-Forwarded-Host` and
  `X-Forwarded-Proto`. If your proxy rewrites `Host` without forwarding the
  original, set `PUBLIC_BASE_URL` to the public origin (the same variable that
  already controls share links) so discovery advertises the address clients
  actually use.

Registration, consent, and token exchange are rate-limited per client address
per process. On Workers that bounds a single isolate, not the whole
deployment.

## Credential-free local verification

Run the local/emulated provider suite with:

```bash
bun run test:provider-local
```

This covers Bun SQLite, the local Bun server runtime, D1/R2 through
Wrangler/Miniflare, and the local Vercel-compatible Node runtime. It does not
deploy to or authenticate with a remote provider.
