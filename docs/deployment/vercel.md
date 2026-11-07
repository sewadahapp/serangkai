# Vercel deployment

Serangkai uses Nitro's `vercel` preset and an explicit Node 24 function runtime.

```bash
bun run build:vercel
bunx vercel deploy --prebuilt
```

## Configuration

Set `JWT_SECRET` and `SHARE_SECRET` as Vercel project secrets. The app validates
both at startup in production.

Artifact storage uses Nitro's storage layer. Set `STORAGE_DRIVER=s3` and the
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION`, and
`S3_BUCKET` variables for durable object storage. Without S3, the local
filesystem driver is ephemeral on Vercel and is only suitable for a smoke test.

## Verification status

- `bun run build:vercel` verifies Vercel Build Output generation.
- `bun run test:vercel-runtime` verifies the Node 24-compatible server locally.
- A remote Vercel deployment has not been performed.

**Durable database boundary:** the local SQLite file is ephemeral on Vercel.
There is no managed database adapter for Vercel in this repository yet, so a
Vercel deployment is not production-ready for durable data even with S3
configured. Do not claim otherwise until a managed database adapter is
implemented and tested.
