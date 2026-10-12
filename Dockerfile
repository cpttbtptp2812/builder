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

# 生产依赖 + tsx。Node 直接跑 .ts 不会解析无扩展名的 import（如 ./profile）。
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx@4.19.4

# Copy server source
COPY server ./server
COPY src ./src
COPY .ownagent ./.ownagent
COPY tsconfig.json ./

# Copy built frontend
COPY --from=frontend-build /app/dist ./dist

# SQLite data volume
RUN mkdir -p /data
ENV DATABASE_PATH=/data/builder.db
ENV OWNAGENT_CONFIG_DIR=/data/.ownagent

# Expose port
EXPOSE 8787

CMD ["npx", "tsx", "server/index.ts"]
