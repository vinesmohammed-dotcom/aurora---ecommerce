#!/usr/bin/env bash
# ==============================================================================
# Aurora E-Commerce — Production Health & Smoke Test Script
# ==============================================================================
# Usage:
#   ./scripts/health-check.sh [DOMAIN_OR_IP]
# Example:
#   ./scripts/health-check.sh store.example.com
# ==============================================================================

set -euo pipefail

TARGET="${1:-localhost}"
echo "========================================================"
echo " Running Aurora Production Health Checks against: $TARGET"
echo " Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================================"

FAILED=0

# 1. Test HTTP Port 80 (Expect 301 or 200 if localhost)
echo -n "[1/5] Checking HTTP Port 80 response... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${TARGET}/" || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
  echo "PASS (HTTP $HTTP_CODE)"
else
  echo "FAIL (HTTP $HTTP_CODE)"
  FAILED=$((FAILED + 1))
fi

# 2. Test API Liveness Probe
echo -n "[2/5] Checking API Liveness (/api/v1/health/live)... "
LIVE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${TARGET}/api/v1/health/live" || echo "000")
if [ "$LIVE_CODE" = "200" ]; then
  echo "PASS (HTTP 200)"
else
  echo "FAIL (HTTP $LIVE_CODE)"
  FAILED=$((FAILED + 1))
fi

# 3. Test API Readiness Probe (Database & App Ready)
echo -n "[3/5] Checking API Readiness (/api/v1/health/ready)... "
READY_BODY=$(curl -s "http://${TARGET}/api/v1/health/ready" || echo '{"status":"error"}')
READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${TARGET}/api/v1/health/ready" || echo "000")
if [ "$READY_CODE" = "200" ]; then
  echo "PASS (HTTP 200: $READY_BODY)"
else
  echo "FAIL (HTTP $READY_CODE: $READY_BODY)"
  FAILED=$((FAILED + 1))
fi

# 4. Test Catalog Public Endpoint
echo -n "[4/5] Checking Public Product Catalog (/api/v1/products)... "
CATALOG_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${TARGET}/api/v1/products?limit=1" || echo "000")
if [ "$CATALOG_CODE" = "200" ]; then
  echo "PASS (HTTP 200)"
else
  echo "FAIL (HTTP $CATALOG_CODE)"
  FAILED=$((FAILED + 1))
fi

# 5. Check SSL/TLS Certificate Expiration if domain is provided
if [ "$TARGET" != "localhost" ] && [ "$TARGET" != "127.0.0.1" ]; then
  echo -n "[5/5] Checking SSL Certificate Expiry for ${TARGET}:443... "
  EXPIRY_DATE=$(echo | openssl s_client -servername "$TARGET" -connect "${TARGET}:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "N/A")
  if [ "$EXPIRY_DATE" != "N/A" ]; then
    echo "PASS (Expires: $EXPIRY_DATE)"
  else
    echo "WARN (Could not read certificate or connection timed out)"
  fi
else
  echo "[5/5] Skipping TLS check for local address ($TARGET)."
fi

echo "========================================================"
if [ $FAILED -eq 0 ]; then
  echo " ALL HEALTH CHECKS PASSED SUCCESSFULLY!"
  exit 0
else
  echo " HEALTH CHECKS FAILED: $FAILED errors detected."
  exit 1
fi
