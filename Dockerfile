FROM node:24-slim AS base

# better-sqlite3 may need a native build when no prebuilt binary matches the
# container's Node ABI. Keep toolchain dependencies in the builder only.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create data directory
RUN mkdir -p /app/data

# Copy built app
COPY --from=base /app/.output ./.output
COPY --from=base /app/package.json ./package.json

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
