# ==============================================================================
# AURORA E-COMMERCE BACKEND — PRODUCTION DOCKERFILE
# Multi-stage lightweight, non-root Alpine container
# ==============================================================================

FROM node:20-alpine AS production

# Install curl for container HEALTHCHECK
RUN apk add --no-cache curl

# Establish standard working directory
WORKDIR /app

# Ensure production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy application source code
COPY src/ ./src/

# Switch to non-root node user (Principle of Least Privilege)
USER node

# Expose backend REST port
EXPOSE 5000

# Container liveness health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/v1/health || exit 1

# Production boot command
CMD ["node", "src/server.js"]
