# syntax=docker/dockerfile:1.7
# Compile once on the builder's CPU, never under target-platform emulation.
# Both values pin multi-platform indexes (not an architecture-specific child).
FROM --platform=$BUILDPLATFORM oven/bun:1.4.0@sha256:5ff609364c049b54eb0ff560ec96319729a972078ef2c755d758f0c6ef89c2d6 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build:node && bun scripts/prepare-docker-output.mjs .output /docker-app

# Target-specific Bun supplies bun:sqlite. There are deliberately no RUN
# instructions in the runtime stages: packaging ARM64 needs no QEMU at all.
FROM oven/bun:1.4.0-slim@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/serangkai.db
ENV STORAGE_PATH=/data/files
ENV STORAGE_DRIVER=local
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# CI already built and tested the candidate. A named context carries only the
# audited deployment output, not host node_modules or an untested second build.
# --target prebuilt --build-context app=/path/from/prepare-docker-output.mjs
FROM runtime AS prebuilt
COPY --from=app / /app/

# Default for docker compose up --build and ordinary source builds.
FROM runtime AS production
COPY --from=build /docker-app/ /app/
