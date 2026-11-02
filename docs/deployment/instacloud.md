# InstaCloud deployment checklist

> **Verification status: not verified.** This project does not claim a native
> InstaCloud one-click deployment until InstaCloud's current template and
> persistent-volume contract has been tested against a real account or official
> local emulator.

## Expected generic-container settings

If InstaCloud supports generic Docker containers, the expected settings are:

- Image: build from this repository's `Dockerfile`
- Port: `3000`
- Persistent mount: `/app/data`
- Required environment variables:
  - `JWT_SECRET`: random, stable secret
  - `SHARE_SECRET`: random, stable secret
  - `NODE_ENV=production`
  - `HOST=0.0.0.0`
  - `PORT=3000`
  - `DATABASE_PATH=/app/data/serangkai.db`
  - `STORAGE_PATH=/app/data/files`
- Health endpoint: `/api/health`

## Verification steps

1. Build the repository Dockerfile on InstaCloud.
2. Confirm the service reaches healthy state on port 3000.
3. Register a test account and create an artifact.
4. Restart/redeploy the service without deleting its volume.
5. Confirm the account and artifact still exist.
6. Confirm public, private, and unlisted links behave correctly.
7. Record the platform template URL, date, image digest, and result here before
   changing this status to verified.
