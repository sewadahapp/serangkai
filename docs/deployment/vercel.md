# Vercel deployment

Nitro documents `vercel` as the current Vercel preset. The repository includes
`vercel.json` and an explicit Node 24 function runtime.

```bash
npm run build:vercel
vercel deploy --prebuilt
```

Set `JWT_SECRET`, `SHARE_SECRET`, `DATABASE_PATH`, and `STORAGE_PATH` in the
Vercel project environment. The default SQLite/filesystem adapter is suitable
only when the deployment has durable writable storage; Vercel serverless
filesystem is ephemeral, so a Vercel deployment requires a portable database and
object-storage adapter for durable production data. Set `STORAGE_DRIVER=s3` and
the `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION`, and
`S3_BUCKET` variables for an S3-compatible object store.

This project verifies the Nitro Vercel output build locally. It does not claim a
production-ready Vercel data path until that adapter is implemented and tested.

`npm run test:vercel-runtime` verifies the same Node 24-compatible application
runtime locally using the Node server preset; `npm run build:vercel` separately
verifies Vercel Build Output generation. A live Vercel deployment still requires
provider credentials and durable object/database storage configuration.
