const { Router } = require("express");
const { getLivenessStatus, getReadinessStatus } = require("./health.controller");

const router = Router();

// GET /api/v1/health & GET /api/v1/health/live - Liveness probe
router.get("/", getLivenessStatus);
router.get("/live", getLivenessStatus);

// GET /api/v1/health/ready - Readiness probe (checks DB)
router.get("/ready", getReadinessStatus);

module.exports = router;
