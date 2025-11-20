# ───────────────────────────────────────────────
# 1️⃣ BUILD STAGE (frontend + backend deps)
# ───────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

WORKDIR /app

# Install system deps required for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development

# Copy package files first to use cache
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend deps
RUN cd backend && \
    (npm ci --no-audit --prefer-offline || npm install --legacy-peer-deps --no-audit --no-fund)

# Install frontend deps
RUN cd frontend && \
    (npm ci --no-audit --prefer-offline || npm install --legacy-peer-deps --no-audit --no-fund)

# Copy full source code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build || \
    (echo "⚠️ Frontend build failed" && \
    mkdir -p dist && \
    printf '<!doctype html><html><body><h1>Frontend build error</h1></body></html>' \
      > dist/index.html)

RUN npm cache clean --force



# ───────────────────────────────────────────────
# 2️⃣ RUNTIME STAGE (minimal production layer)
# ───────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8010
EXPOSE 8010

# SQLite runtime library
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
 && rm -rf /var/lib/apt/lists/*

# Copy ONLY package files first
COPY backend/package*.json /app/

# Install runtime dependencies
RUN npm ci --omit=dev --no-audit --prefer-offline && npm cache clean --force

# Copy backend FULLY (now npm ci will NOT delete these files!)
COPY --from=build /app/backend /app

# Copy frontend build output
COPY --from=build /app/frontend/dist /app/public

# Create persistent data directory
RUN mkdir -p /data

CMD ["node", "server.js"]
