# ---- Builder Stage ----
FROM node:20-slim AS builder

# Install build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for Docker layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/

RUN npm ci

# Copy source code
COPY packages/ packages/
COPY apps/ apps/
COPY tsconfig.json ./

# Build in dependency order: shared → server → client
RUN npm run build -w packages/shared
RUN npm run build -w apps/server
RUN npm run build -w apps/client

# ---- Runtime Stage ----
FROM node:20-slim

# Install build tools needed for better-sqlite3 native compilation during npm ci
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/apps/server/dist apps/server/dist
COPY --from=builder /app/apps/client/dist apps/client/dist

# Create data directory for SQLite (will be overridden by Railway volume mount)
RUN mkdir -p /app/data

ENV NODE_ENV=production

EXPOSE 8005

WORKDIR /app/apps/server

CMD ["node", "dist/index.js"]
