const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const HTTP_CODES = require("../constants/httpCodes");
const ERROR_CODES = require("../constants/errorCodes");

/**
 * General API Rate Limiting Middleware
 */
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isDevelopment || env.isTest ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HTTP_CODES.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Too many requests from this IP address, please try again after 15 minutes.",
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      errors: []
    });
  }
});

/**
 * Strict Rate Limiter for Login and Password Reset
 * Defends against brute-force attacks and credential stuffing.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDevelopment || env.isTest ? 500 : 10, // Max 10 attempts in production
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HTTP_CODES.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Too many authentication attempts. Please try again after 15 minutes.",
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      errors: []
    });
  }
});

/**
 * Strict Rate Limiter for OTP Generation & Verification
 * Defends against SMS/Email bombing and OTP enumeration.
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDevelopment || env.isTest ? 500 : 5, // Max 5 attempts in production
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HTTP_CODES.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Too many OTP requests. Please wait 15 minutes before requesting again.",
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      errors: []
    });
  }
});

module.exports = {
  apiRateLimiter,
  authLimiter,
  otpLimiter
};
