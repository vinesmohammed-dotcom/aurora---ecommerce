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

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: env.isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false
  })
);

// 2. Strict CORS Configuration (Credentials enabled, specific origin)
app.use(
  cors({
    origin: (origin, callback) => {
      // In development, allow requests without origin (like Postman or curl) or matching FRONTEND_URL
      if (!origin || origin === env.FRONTEND_URL || env.isDevelopment) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
      }
    },
    credentials: true, // Mandatory for session cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  })
);

// 3. Body Parsing Middleware with size limits
app.use(express.json({ limit: "10kb" }));
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
