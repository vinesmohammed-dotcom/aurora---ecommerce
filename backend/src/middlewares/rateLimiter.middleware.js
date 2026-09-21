const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const HTTP_CODES = require("../constants/httpCodes");
const ERROR_CODES = require("../constants/errorCodes");

/**
 * General API Rate Limiting Middleware
 * Protects against brute-force, scraping, and DoS spam.
 */
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isDevelopment ? 1000 : 100, // Relaxed limit in dev (1000), strict in prod (100)
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res) => {
    res.status(HTTP_CODES.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Too many requests from this IP address, please try again after 15 minutes.",
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      errors: []
    });
  }
});

module.exports = apiRateLimiter;
