# ───────────────────────────────────────────────
# 1️⃣ BUILD STAGE – build frontend
# ───────────────────────────────────────────────
FROM node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
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
    npm ci --no-audit --prefer-offline

# Copy frontend sources
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build


# ───────────────────────────────────────────────
# 2️⃣ RUNTIME STAGE – backend + built frontend
# ───────────────────────────────────────────────
FROM node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS runtime
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

RUN apt-get update && apt-get upgrade -y \
 && command -v setpriv \
 && rm -rf /var/lib/apt/lists/*

# 1. Install deps
COPY backend/package*.json /app/
RUN npm ci --omit=dev --ignore-scripts --no-audit --prefer-offline && npm cache clean --force

# Installation tools are unnecessary in the running service; their bundled
# dependencies otherwise remain a separate source of runtime image advisories.
RUN rm -rf /usr/local/lib/node_modules/npm /opt/yarn-v1.22.22 \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg

# 2. Copy FULL backend – this brings schema.sql!
COPY backend /app

# 3. Copy frontend build
COPY --from=build /app/frontend/dist /app/public

RUN mkdir -p /data \
 && chown -R node:node /app /data

COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "server.js"]
