const { Router } = require("express");
const { getHealthStatus } = require("./health.controller");

const router = Router();

// GET /api/v1/health
router.get("/", getHealthStatus);

module.exports = router;
