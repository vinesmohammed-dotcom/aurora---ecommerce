# ==============================================================================
# AURORA E-COMMERCE FRONTEND — MULTI-STAGE PRODUCTION DOCKERFILE
# Stage 1: Build React 19 + Vite 8 SPA into static assets
# Stage 2: Serve static distribution via lightweight Nginx Alpine container
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies required for Vite build)
RUN npm ci

# Copy frontend source code
COPY . .

# Build Vite single-page application
ARG VITE_API_URL="http://localhost:5000/api/v1"
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Nginx Server
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built distribution from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with SPA fallback and security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://localhost/healthz || exit 1

# Launch Nginx in foreground mode
CMD ["nginx", "-g", "daemon off;"]
