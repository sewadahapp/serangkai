# Releasing and deployment status

Maintainer notes: what each deployment path has actually been tested against,
and how container images are published.

## What has actually been exercised

Docker persistence is checked locally with Podman: the container is replaced on
the same volume and the owner, rangka, uploads, tokens, and share links are
verified. Run `bun run test:docker` to repeat the check with Podman or Docker.

Vercel and Cloudflare are exercised through their credential-free local test
matrices, not a hosted deployment. Nothing in this repository deploys
anywhere on its own, and no platform is a supported contract until health and
persistence have been verified after a real deployment. Run
`bun run test:provider-local` for the local matrix.

Provider builds:

```bash
bun run build:cloudflare
bun run build:vercel
```

Cloudflare uses Nitro's `cloudflare_module` preset with D1 or Turso for rows
and R2 or S3-compatible storage for files. Local Wrangler/Miniflare tests cover
all four provider combinations, including signed B2 requests and a Turso + B2
Worker with no D1/R2 bindings. The D1 + B2 test also checks updates, deletes,
and persistence across a Worker restart. Vercel uses Nitro's `vercel` preset
and a Node 24 function runtime, but its filesystem is ephemeral: durable data
needs an external database plus `STORAGE_DRIVER=s3`.

Turso checks use the production libSQL HTTP client with a local SQLite-backed
Hrana fixture. Hosted Turso validation remains a deployment step.

## Publishing an image

Images are published by the **Release** workflow, run manually from the Actions
tab: *Actions → Release → Run workflow*. It takes an optional exact version and a
bump, then in one run:

1. Bumps `package.json` from conventional commits and writes `CHANGELOG.md`
   locally, saving the exact release candidate for recovery.
2. Runs `bun run test:ci`, compiling the candidate once on the native runner.
3. Packages that tested output into `linux/amd64` and `linux/arm64` images.
4. Boots **both** target runtimes and checks login, SQLite writes, uploads, and
   persistence after container replacement.
5. Promotes it to `:X.Y.Z` and `:latest`.
6. Pushes the release commit and an annotated `vX.Y.Z` tag.
7. Publishes a GitHub release with the changelog section as its notes.

The order is deliberate: each step is harder to undo than the last, and nothing
irreversible happens until the image has actually started. The image is staged
under a commit tag first; a failed build or a container that never answers
health leaves no version tag and no `:latest` behind.

**Recovering from a failure.** Use **Re-run failed jobs** on the same Actions run
within 30 days. Its saved candidate restores the exact version, commit, tag,
and notes, including after a successful git push. A matching staged image skips
compilation and packaging, but always repeats both runtime smoke tests. Recovery
compares manifest digests and refuses to overwrite a different published image.
An existing GitHub release is left intact. A new manual dispatch starts a new
release; it is not the way to resume a partly published one.

To see what a release would do without publishing anything, run **Release
rehearsal**. It computes the version, writes the changelog in the runner, builds
the images from the same tested output, and smoke-tests both architectures,
then discards all of it.

Nuxt/Vite builds never run under QEMU. `BUILDPLATFORM` handles source builds;
only the short ARM64 runtime verification uses emulation on an AMD64 runner.
If ARM64 verification is unavailable, select **linux/amd64** in the release or
rehearsal `platforms` input. This publishes an explicitly AMD64-only image; it
does not silently claim ARM64 support or extend a timeout. For the hand-pushed
tag workflow, repository variable `SERANGKAI_IMAGE_PLATFORMS=linux/amd64` selects
the same fallback. See [build strategy, recovery, and measurements](release-builds.md).

A version is required to advance and tags are checked for collisions. Until the
first release there is no `:latest` image; build from source with
`docker compose up --build` instead.

The first published package is private by default, even from a public
repository, so anonymous `docker pull` returns 401 until it is set to public once
under *Package settings → Danger Zone → Change visibility*. That cannot be undone,
which is why the workflow does not do it automatically.
