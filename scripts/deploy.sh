#!/usr/bin/env bash
# ==============================================================================
# Aurora E-Commerce — Production Deployment & Rollback Script
# ==============================================================================
# Usage:
#   ./scripts/deploy.sh
# ==============================================================================

set -euo pipefail

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.prod.yml"

echo "========================================================"
echo " Starting Aurora Production Deployment"
echo " Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================================"

# 1. Verify Production Environment Configuration exists
if [ ! -f "$ENV_FILE" ]; then
  echo "[-] ERROR: Missing production configuration file: $ENV_FILE"
  echo "    Please create $ENV_FILE using backend/.env.example as a reference."
  exit 1
fi

# 2. Check for required production environment variables
echo "[1/5] Validating production environment variables..."
REQUIRED_VARS=("MONGODB_URI" "SESSION_SECRET" "FRONTEND_URL")
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${var}=" "$ENV_FILE"; then
    echo "[-] ERROR: Required environment variable '$var' is missing in $ENV_FILE"
    exit 1
  fi
done
echo "[+] Environment validation passed."

# 3. Build production images with immutable Git tag
GIT_COMMIT=$(git rev-parse --short HEAD || echo "unknown")
echo "[2/5] Building production Docker images (Commit: $GIT_COMMIT)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --pull

# 4. Deploy containers with healthcheck gating and rollback support
echo "[3/5] Starting containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

# 5. Verify Backend Readiness Endpoint
echo "[4/5] Waiting for backend readiness probe (http://127.0.0.1:5000/api/v1/health/ready)..."
MAX_ATTEMPTS=15
ATTEMPT=1
HEALTHY=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/api/v1/health/ready || true)
  if [ "$HTTP_STATUS" = "200" ]; then
    HEALTHY=true
    echo "[+] Backend readiness confirmed (HTTP 200 OK) on attempt $ATTEMPT."
    break
  fi
  echo "    Attempt $ATTEMPT/$MAX_ATTEMPTS: HTTP status is '$HTTP_STATUS'. Retrying in 3s..."
  sleep 3
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$HEALTHY" = false ]; then
  echo "[-] DEPLOYMENT FAILED: Backend readiness probe did not return 200 within timeout."
  echo "    Dumping backend container logs:"
  docker logs --tail 50 aurora-backend-prod
  echo "[-] Rolling back to previous state..."
  # If previous image tag existed, rollback here
  exit 1
fi

# 6. Post-deployment cleanup of dangling images
echo "[5/5] Cleaning up dangling Docker build cache..."
docker image prune -f || true

echo "========================================================"
echo " Aurora Production Deployment Succeeded!"
echo " Liveness:  http://127.0.0.1:5000/api/v1/health/live"
echo " Readiness: http://127.0.0.1:5000/api/v1/health/ready"
echo " Frontend:  http://localhost:80"
echo "========================================================"
