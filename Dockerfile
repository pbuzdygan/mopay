# ───────────────────────────────────────────────
# 1️⃣ BUILD STAGE – build frontend
# ───────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
ARG APP_VERSION=dev
ARG APP_REPO=pbuzdygan/mopay
ARG APP_CHANNEL=main
ENV VITE_APP_VERSION=$APP_VERSION
ENV VITE_GITHUB_REPO=$APP_REPO
ENV VITE_APP_CHANNEL=$APP_CHANNEL

WORKDIR /app

# System deps for native modules (if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development

# Use cache for npm
COPY frontend/package*.json ./frontend/

RUN cd frontend && \
    (npm ci --no-audit --prefer-offline || npm install --legacy-peer-deps --no-audit --no-fund)

# Copy frontend sources
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build || \
  (echo "⚠️ Frontend build failed" && \
   mkdir -p dist && \
   printf '<!doctype html><html><body><h1>Frontend build error</h1></body></html>' > dist/index.html)



# ───────────────────────────────────────────────
# 2️⃣ RUNTIME STAGE – backend + built frontend
# ───────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
ARG APP_VERSION=dev
ARG APP_REPO=pbuzdygan/mopay
ARG APP_CHANNEL=main
ENV APP_VERSION=$APP_VERSION
ENV APP_REPO=$APP_REPO
ENV APP_CHANNEL=$APP_CHANNEL

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8010
EXPOSE 8010

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
 && rm -rf /var/lib/apt/lists/*

# 1. Install deps
COPY backend/package*.json /app/
RUN npm ci --omit=dev --no-audit --prefer-offline && npm cache clean --force

# 2. Copy FULL backend – this brings schema.sql!
COPY backend /app

# 3. Copy frontend build
COPY --from=build /app/frontend/dist /app/public

RUN mkdir -p /data

CMD ["node", "server.js"]
