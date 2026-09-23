const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const env = require("./config/env");
const configureSession = require("./config/session");
const loggerMiddleware = require("./middlewares/logger.middleware");
const { apiRateLimiter } = require("./middlewares/rateLimiter.middleware");
const notFoundMiddleware = require("./middlewares/notFound.middleware");
const errorMiddleware = require("./middlewares/error.middleware");
const apiRouter = require("./routes");

/**
 * Initialize and configure Express application
 * Note: Database connection is strictly decoupled and executed in server.js
 */
const app = express();

// 1. Security Headers via Helmet with explicit Razorpay directives & HSTS
app.use(
  helmet({
    contentSecurityPolicy: env.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
            frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
            connectSrc: [
              "'self'",
              "https://api.razorpay.com",
              "https://lumberjack.razorpay.com",
              env.FRONTEND_URL
            ],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
          }
        }
      : false,
    crossOriginEmbedderPolicy: false,
    hsts: env.isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      : false
  })
);

// 2. Strict CORS Configuration (Credentials enabled, specific origin)
app.use(
  cors({
    origin: (origin, callback) => {
      // In development/test, allow requests without origin (like Postman/curl/supertest) or matching FRONTEND_URL
      if (!origin || origin === env.FRONTEND_URL || env.isDevelopment || env.isTest) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
      }
    },
    credentials: true, // Mandatory for session cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Idempotency-Key",
      "idempotency-key",
      "x-razorpay-signature",
      "x-razorpay-event-id"
    ]
  })
);

// 3. State-Changing CSRF & Origin Validation Guard (exempting public HMAC webhooks)
app.use((req, res, next) => {
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const isPublicWebhook = req.originalUrl?.includes("/payments/webhook") || req.path?.includes("/payments/webhook");

  if (isStateChanging && !isPublicWebhook && env.isProduction) {
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    if (origin && origin !== env.FRONTEND_URL) {
      return res.status(403).json({
        success: false,
        message: "Cross-Site Request Forgery (CSRF) validation failed: untrusted origin.",
        code: "CSRF_ORIGIN_MISMATCH",
        errors: []
      });
    }
  }
  next();
});

// 3. Body Parsing Middleware with size limits & raw buffer capture for webhooks
app.use(
  express.json({
    limit: "10kb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// 4. Request Logging Middleware (sanitized)
app.use(loggerMiddleware());

// 5. Global Rate Limiter
app.use("/api", apiRateLimiter);

// 6. Session Middleware with MongoDB persistence
app.use(configureSession());

// 7. Mount Versioned API Routes (/api/v1)
app.use("/api/v1", apiRouter);

// 8. 404 Route Not Found Handler
app.use(notFoundMiddleware);

// 9. Centralized Global Error Handler
app.use(errorMiddleware);

module.exports = app;
