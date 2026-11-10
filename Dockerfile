# Build stage: Bun installs and builds the app.
FROM oven/bun:1.4.0 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN bun run build

# Production stage: the Nitro node-server output runs under Bun.
FROM oven/bun:1.4.0-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# Persistent data lives under /data; mount a volume here in production.
ENV DATABASE_PATH=/data/serangkai.db
ENV STORAGE_PATH=/data/files
ENV STORAGE_DRIVER=local

RUN mkdir -p /data

COPY --from=build /app/.output ./.output
COPY --from=build /app/scripts/start.mjs /app/scripts/session-secret.mjs ./scripts/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
