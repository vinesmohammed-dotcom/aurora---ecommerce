const ApiResponse = require("../../utils/ApiResponse");
const HTTP_CODES = require("../../constants/httpCodes");
const { getDBStatus } = require("../../config/database");

/**
 * Process Liveness Endpoint: GET /api/v1/health
 * Verifies that the Node.js process is alive, running, and accepting HTTP requests.
 * Does not depend on external services.
 */
const getLivenessStatus = (req, res) => {
  const livenessData = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    processId: process.pid
  };

  new ApiResponse(HTTP_CODES.OK, livenessData, "Process is alive and healthy").send(res);
};

let isShuttingDown = false;

const setShuttingDown = (flag) => {
  isShuttingDown = Boolean(flag);
};

/**
 * Dependency Readiness Endpoint: GET /api/v1/health/ready
 * Verifies that the application's critical backing services (MongoDB) are reachable
 * and ready to serve live production traffic. Returns 503 during graceful shutdown.
 */
const getReadinessStatus = (req, res) => {
  const dbStatus = getDBStatus();
  const isReady = dbStatus === "connected" && !isShuttingDown;

  const readinessData = {
    status: isShuttingDown ? "shutting_down" : isReady ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    shuttingDown: isShuttingDown
  };

  if (!isReady) {
    return new ApiResponse(
      HTTP_CODES.SERVICE_UNAVAILABLE,
      readinessData,
      isShuttingDown
        ? "Service is shutting down and draining connections"
        : "Service is not ready: database connection is unavailable"
    ).send(res);
  }

  new ApiResponse(HTTP_CODES.OK, readinessData, "Service is ready to handle traffic").send(res);
};

module.exports = {
  getLivenessStatus,
  getReadinessStatus,
  setShuttingDown
};
