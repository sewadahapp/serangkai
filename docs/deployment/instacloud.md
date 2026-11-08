# InstaCloud deployment checklist

> **Verification status: not verified.** This project does not claim a native
> InstaCloud one-click deployment until InstaCloud's current template and
> persistent-volume contract has been tested against a real account or official
> local emulator.

No InstaCloud credentials, account, or official local emulator is available in
this development environment. The settings below are a deployment checklist for
the container path, not evidence of platform support.

## Docker image path

Serangkai ships as a single container image and keeps SQLite plus uploaded files
under `/data`. If InstaCloud can run a Docker image, that is the path to use.
The platform does not need to understand the Nuxt build: it only needs to run
the image, mount a persistent volume, and pass the required environment
variables.

### Option A: use a published image

The included GitHub Actions workflow (`.github/workflows/docker.yml`) publishes
multi-arch images to GHCR on `v*` tags and manual dispatch:

```bash
docker pull ghcr.io/OWNER/REPO:latest
```

If the repository is not connected to GitHub, or InstaCloud cannot pull from
GHCR, push the same image to any registry InstaCloud accepts:

```bash
docker build -t registry.example.com/OWNER/serangkai:latest .
docker push registry.example.com/OWNER/serangkai:latest
```

### Option B: build on InstaCloud from this repository

If the platform supports building a `Dockerfile` from a Git repository, point it
at the repository root. The image expects no build arguments.

### Option C: upload an image archive

If InstaCloud accepts image archives rather than a registry reference:

```bash
docker build -t serangkai:latest .
docker save serangkai:latest | gzip > serangkai-image.tar.gz
```

## Container settings

- Image: the published or locally built `serangkai` image
- Port: `3000`
- Persistent mount: `/data`
- Health endpoint: `/api/health`
- Required environment variables:
  - `ADMIN_USERNAME`: the single owner login name
  - `ADMIN_PASSWORD`: the owner password (at least 8 characters)
  - `JWT_SECRET`: random, stable session root secret
  - `SHARE_SECRET`: random, stable share-link secret
- Optional environment variables:
  - `DATABASE_PATH` (defaults to `/data/serangkai.db`)
  - `STORAGE_PATH` (defaults to `/data/files`)
- Optional:
  - `PUBLIC_BASE_URL`: public origin used when generating share links. Set this
    when the platform terminates TLS or serves the app behind a proxy.

Do not enable object storage or D1 bindings on InstaCloud unless the platform
explicitly provides them; the container's default is local SQLite plus
filesystem storage on the mounted volume.

## Verify with Docker Compose

The repository includes a compose file that runs a published image without
building:

```bash
SERANGKAI_IMAGE=registry.example.com/OWNER/serangkai:latest \
ADMIN_USERNAME=admin ADMIN_PASSWORD='...' \
JWT_SECRET=... SHARE_SECRET=... \
docker compose -f docker-compose.image.yml up -d
```

`docker-compose.yml` builds from source instead; use it when testing local
changes.

## Verification steps

1. Build or pull the image and confirm the platform pulls the expected digest.
2. Start the service with the persistent mount and the four required variables.
3. Confirm `/api/health` reports healthy on port 3000.
4. Sign in at `/auth/login` with the configured owner credentials and create an artifact.
5. Restart/redeploy the service without deleting its volume.
6. Confirm the owner can still sign in and the artifact and uploaded file still exist.
7. Confirm private, public, and unlisted links behave correctly, including a
   signed `?k=` link for an unlisted artifact.
8. Record the platform image reference, digest, date, and result here before
   changing this status to verified.

Only after all of the above should `docs/deployment/README.md` and
`docs/deployment/verification-matrix.md` describe InstaCloud as verified.
