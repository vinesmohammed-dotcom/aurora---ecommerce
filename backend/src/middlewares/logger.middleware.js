const morgan = require("morgan");
const env = require("../config/env");

/**
 * Structured HTTP Request Logger Middleware
 * Logs method, path, status code, and response time.
 * Never logs request bodies, passwords, cookies, or secrets.
 */
const loggerMiddleware = () => {
  if (env.isTest) {
    // Return dummy no-op middleware in test mode to keep test output pristine
    return (req, res, next) => next();
  }

  // Format: [HTTP] GET /api/v1/health 200 - 4.12 ms
  return morgan("[:date[iso]] :method :url :status :res[content-length] - :response-time ms");
};

module.exports = loggerMiddleware;
