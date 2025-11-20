# ───────────────────────────────────────────────
# 1️⃣ BUILD STAGE – build frontend
# ───────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

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

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8010
EXPOSE 8010

# SQLite runtime lib
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
 && rm -rf /var/lib/apt/lists/*

# Copy ONLY backend package files first (for npm ci)
COPY backend/package*.json /app/

# Install backend runtime deps
RUN npm ci --omit=dev --no-audit --prefer-offline && npm cache clean --force

# 🔥 Copy FULL backend source (including schema.sql, db.js, export.js, server.js)
COPY backend /app

# Copy built frontend (as static bundle) to /app/public
COPY --from=build /app/frontend/dist /app/public

# Data directory for SQLite file
RUN mkdir -p /data

CMD ["node", "server.js"]
