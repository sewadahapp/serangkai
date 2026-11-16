# Serangkai on Cloudflare Workers + Turso + Backblaze B2

[Choose providers](https://github.com/sewadahapp/serangkai/blob/master/docs/deploy-cloudflare.md) ·
[Deploy this combination](https://deploy.workers.cloudflare.com/?url=https://github.com/sewadahapp/serangkai/tree/master/deploy/cloudflare-turso-b2)

This standalone template uses **Turso/libSQL** for database rows and
**Backblaze B2** for rangka content and uploaded files. Its Wrangler
configuration has **no D1 or R2 bindings**.

Create a Turso database with a read/write database token and a private B2
bucket with a bucket-scoped application key first. The deployment page prompts
for the five owner/session secrets, two Turso credentials, and five `S3_*`
values in `.dev.vars.example`. Keep session/share secrets stable. B2's
endpoint must include `https://`; keep only the latest object versions with a
bucket lifecycle rule. See the [provider setup guide](https://github.com/sewadahapp/serangkai/blob/master/docs/deploy-cloudflare.md)
for details.

`build.mjs` downloads application source at the immutable `serangkai.ref` pin.
An explicit `SERANGKAI_REF` overrides it; `SERANGKAI_REPO` selects a fork.
`.output/serangkai-source.json` records the source used. To upgrade, update
the pin deliberately and redeploy. To rehearse from a local checkout:

```bash
SERANGKAI_LOCAL_SOURCE=/path/to/serangkai bun run build
# Copy .dev.vars.example to .dev.vars and replace the placeholders, then:
bunx --bun wrangler@4.156.1 dev --local
```

Local development uses the configured remote services; choose development
accounts/buckets for test writes. For manual deployment, set each secret with
`bunx --bun wrangler@4.156.1 secret put NAME`, then run `bun run deploy`.
The full repository provides `bun run deploy:turso-b2` with
`wrangler.turso-b2.jsonc` for the same combination.

Database imports and file transfers are explicit. A health response alone
does not verify persistence: test login, a rangka write, and binary
upload/download. Local Worker checks use libSQL and S3 fixtures; hosted Turso,
B2, and the button flow still require deployment verification.
