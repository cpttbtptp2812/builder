# ─────────────────────────────────────────────
# Stage 1: Build frontend
# ─────────────────────────────────────────────
FROM node:24-slim AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Production image (Node 24 + SQLite)
# ─────────────────────────────────────────────
FROM node:24-slim AS production
WORKDIR /app

# Install only server dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server ./server
COPY tsconfig.json ./

# Copy built frontend
COPY --from=frontend-build /app/dist ./dist

# SQLite data volume
RUN mkdir -p /data
ENV DATABASE_PATH=/data/builder.db

# Expose port
EXPOSE 8787

# Start server (Node 24 runs TypeScript natively via --experimental-strip-types)
CMD ["node", "--experimental-strip-types", "server/index.ts"]
