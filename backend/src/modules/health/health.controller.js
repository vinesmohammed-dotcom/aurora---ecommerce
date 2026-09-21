const ApiResponse = require("../../utils/ApiResponse");
const { getDBStatus } = require("../../config/database");

/**
 * Health Check Controller
 * Returns server operational status, uptime, and database connectivity.
 */
const getHealthStatus = (req, res) => {
  const healthData = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: getDBStatus()
  };

  new ApiResponse(200, healthData, "API is healthy").send(res);
};

module.exports = {
  getHealthStatus
};
