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

/**
 * Rate Limiter for Online Payment Operations (create, verify, retry)
 * Defends against checkout spam and signature verification flooding.
 */
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isDevelopment || env.isTest ? 500 : 30, // 30 requests per 15 min in production
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HTTP_CODES.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Too many payment operations requested. Please wait a few minutes before retrying.",
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      errors: []
    });
  }
});

/**
 * High-Capacity Rate Limiter for Gateway Webhooks
 * Permits burst webhook deliveries while preventing denial of service.
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.isDevelopment || env.isTest ? 1000 : 120, // 120 webhooks per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HTTP_CODES.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Webhook rate limit exceeded.",
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      errors: []
    });
  }
});

module.exports = {
  apiRateLimiter,
  authLimiter,
  otpLimiter,
  paymentLimiter,
  webhookLimiter
};
