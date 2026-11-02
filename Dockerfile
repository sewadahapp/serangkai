FROM node:24-alpine AS base

# Install bun
RUN npm install -g bun

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
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create data directory
RUN mkdir -p /app/data

# Copy built app
COPY --from=base /app/.output ./.output
COPY --from=base /app/package.json ./package.json

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
