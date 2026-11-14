# Docker release builds

The release, Docker image, and release rehearsal workflows share one rule:
compile Nuxt on the builder's native CPU, then package the deployment output
with a runtime for each target CPU. The overall release timeout stays at 45
minutes; increasing it is not the fix.

## Failure and choice

In [run 43585899251](https://github.com/sewadahapp/serangkai/actions/runs/43585899251/job/132420186402),
the tests passed in 26 seconds, but Build and stage the image ran from 10:34:59
to 11:19:13 UTC (44 minutes 14 seconds) before cancellation. The job ran for
45 minutes 19 seconds including cleanup. The supplied logs show an approximately
8-second AMD64 client build while the ARM64 client bundler ran for over 43
minutes. The old Dockerfile selected the target platform for its build stage,
so an AMD64 runner compiled Nuxt twice, with ARM64's Bun/Vite running in QEMU.

| Approach | Compilation | Native dependency handling | Choice |
| --- | --- | --- | --- |
| `BUILDPLATFORM`, target-specific runtime | Once on native AMD64 (or native ARM64 on an ARM builder) | Requires portable JS/Wasm output; target Bun supplies built-in SQLite | Used here; one inexpensive runner and no emulated compiler |
| Separate `ubuntu-24.04` / `ubuntu-24.04-arm` builds | Once per architecture | Each runner builds/installs its own native modules | Use if future runtime dependencies require native addons; adds runner/artifact/manifest coordination and duplicates Nuxt compilation |

GitHub provides native ARM64 runners, but this design does not require them.
An ARM64 machine can run the same smoke script natively. On the AMD64 CI runner,
QEMU is installed **after** image packaging and is used only for bounded runtime
verification. Both target images must pass; ARM64 failure blocks promotion.

References: [Docker multi-platform build strategies](https://docs.docker.com/build/building/multi-platform/),
[GitHub runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners),
and [Bun's built-in SQLite driver](https://bun.sh/docs/runtime/sqlite).

## SQLite and Bun portability

`server/db/index.ts` branches on `process.versions.bun`: under Docker it loads
`bun:sqlite`, which is built into the architecture-specific Bun executable in
the runtime image. The Node fallback uses `better-sqlite3`. Version 13.0.3 ships
prebuilt `.node` files for multiple operating systems and architectures; Nitro
copies those into its node-server output even though Docker never loads them.

`prepare-docker-output.mjs` copies the tested output, removes only those unused
SQLite prebuild/build directories in that copy, and rejects remaining native
addons or ELF/Mach-O/PE binaries and escaping symlinks. The original `.output`
and its Node fallback remain intact. JS and Wasm are portable. An added native
dependency fails this gate rather than silently shipping an AMD64 library in an
ARM64 image. Such a change needs a target-native dependency stage or separate
native runners, with both runtime tests retained.

The build and runtime Bun **multi-platform index digests** are pinned in the
Dockerfile, along with Bun 1.4.0 and `bun.lock`. Architecture-specific child
digests must not be substituted for those indexes. The compiler frontend and
runtime-emulation helper are also versioned/pinned. Update digests deliberately.

## One compilation, caching, and smoke verification

- Source Docker builds use `FROM --platform=$BUILDPLATFORM` and compile once.
  Runtime stages have no `RUN` commands; they copy portable output onto the
  target's Bun image. Packaging works without QEMU installed.
- Release/rehearsal bump the local candidate before `bun run test:ci`. That
  command compiles node-server output once and tests it. Docker's `prebuilt`
  target receives the audited copy through the named `app` build context and
  never compiles it again. Rehearsal loads each target with a separate local tag
  so it also works with GitHub's classic single-platform Docker image store.
- Cache only Bun's download cache on the host and BuildKit layers under explicit
  source/prebuilt/platform scopes. Frozen installation and source content remain
  authoritative. Do not reuse host `node_modules` or cache `.output` as a way to
  bypass tests. Failed cache lookup never changes the locked dependency versions.
- `smoke-docker.sh` verifies the target Bun's `process.arch`, starts the real
  entrypoint, logs in, writes a rangka to SQLite, uploads a file, replaces the
  container on the same fresh volume, and verifies both records survived. Every
  pull, architecture probe, request, and startup loop is bounded; workflow-level
  timeouts also cover cleanup and unexpected Docker hangs.
- Release and Docker publication use the smoke-tested **digest**, not a mutable
  tag. Version and latest tags appear only after runtime verification. CI logs
  and step summaries record compilation/packaging and per-architecture timings.

## Recovery and fallback

Release saves a small `release-candidate` Actions artifact **before publication**:
the candidate git bundle, source/commit/version/platform metadata, and release
notes. Use **Re-run failed jobs** on that same run within its 30-day retention.
Checkout is pinned to the original source SHA. Restoring the bundle prevents a
post-push retry from calculating the next version or creating a different
release commit. The artifact contains no credentials or application data.

Staging names include source, version, and platform selection. An existing
version is resumable only when its manifest digest equals the matching staging
digest; registry/auth/network errors fail closed. A staging tag alone never
skips smoke testing. Promotion copies that exact digest without rebuilding.
Git commit and tag are pushed atomically; recovery never rewinds subsequent
branch commits, and an already-created GitHub release is not recreated.
Cleanup never deletes a GHCR manifest that also carries a published version tag.

If the ARM64 runtime cannot be verified (no working native runner or emulator),
start a new **Release rehearsal** with `platforms=linux/amd64`, then **Release**
with the same platform selection. Do this only before the failed candidate has
been promoted; an existing published version cannot be replaced by a different
architecture set. For a hand-pushed tag, set repository variable
`SERANGKAI_IMAGE_PLATFORMS=linux/amd64` before rerunning **Docker image**. Do not
increase the timeout or leave an unverified ARM64 manifest in a release.

## Reproduce local checks

```sh
bun install --frozen-lockfile --ignore-scripts
bun run test:ci
bun scripts/prepare-docker-output.mjs .output /tmp/serangkai-docker-app
docker buildx build --platform linux/amd64,linux/arm64 --target prebuilt \
  --build-context app=/tmp/serangkai-docker-app --tag serangkai:check --load .
timeout 360 bash scripts/smoke-docker.sh serangkai:check linux/amd64,linux/arm64
```

Multi-platform `--load` requires a containerd image store. With a classic store,
build/load one target at a time with separate tags as rehearsal does. ARM64
execution on an AMD64 host requires binfmt/QEMU support; compilation does not.
The smoke script also runs without QEMU on a matching native architecture.

## Measurements

Local timings below use an AMD64 Docker host; they are not GitHub-hosted runner
benchmarks. ARM64 runtime verification executes actual ARM64 Bun under QEMU,
not on native ARM hardware. Measured with `/usr/bin/time -p`, BuildKit's plain
progress log, and the smoke script's elapsed timer on 2026-11-14:

| Operation | Duration |
| --- | ---: |
| Native Nuxt compilation inside `test:ci` | 26.4s |
| Full `test:ci` (one build + 197 passing tests) | 55.31s |
| First source Docker build, both targets (base/dependency work included) | 97.83s |
| Nuxt inside that source Docker build (single AMD64 build stage) | 25.2s |
| Fully cached source Docker build, both targets | 2.68s |
| Audit/copy the tested output for Docker | 2.80s |
| Package/load both targets via `prebuilt` (no compilation) | 5.61s |
| AMD64 packaged-container smoke, including replacement | 7s |
| ARM64 packaged-container smoke under QEMU, including replacement | 19s |

Both source-built and prebuilt image paths were exercised. The build log has
one `[linux/amd64 build]` compilation stage and none for ARM64. Workflow
validation passed actionlint 1.7.12, Bash syntax checks, and regression tests for
native-binary rejection, digest conflicts, and exact candidate recovery before
and after pushing a tag. A public-registry inspection also verified the digest
helper against the pinned Bun runtime index. No hosted Actions run, GHCR
publication, git push, or GitHub release was performed during local validation.
