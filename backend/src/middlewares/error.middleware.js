const env = require("../config/env");
const AppError = require("../utils/AppError");
const HTTP_CODES = require("../constants/httpCodes");
const ERROR_CODES = require("../constants/errorCodes");

/**
 * Global Centralized Error Handler Middleware
 */
const errorMiddleware = (err, req, res, next) => {
  let error = err;

  // If not already an instance of AppError, convert known library errors
  if (!(error instanceof AppError)) {
    // 1. Mongoose Bad ObjectId (CastError)
    if (err.name === "CastError") {
      error = new AppError(
        `Invalid resource identifier: ${err.value}`,
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    // 2. Mongoose Duplicate Key (Code 11000)
    else if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || "field";
      error = new AppError(
        `A record with this ${field} already exists.`,
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }
    // 3. Mongoose Schema Validation Error
    else if (err.name === "ValidationError") {
      const errors = Object.values(err.errors || {}).map((e) => ({
        field: e.path,
        message: e.message
      }));
      error = new AppError(
        "Schema validation failed",
        HTTP_CODES.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        errors
      );
    }
    // 4. Zod Validation Error
    else if (err.name === "ZodError" || err.issues) {
      const errors = (err.issues || []).map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }));
      error = new AppError(
        "Request validation failed",
        HTTP_CODES.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        errors
      );
    }
    // 5. Unhandled Runtime Programmer Error
    else {
      console.error("[CRITICAL UNHANDLED ERROR]", err);
      error = new AppError(
        "An unexpected error occurred on the server. Please try again later.",
        HTTP_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
      error.isOperational = false;
    }
  }

  const statusCode = error.statusCode || HTTP_CODES.INTERNAL_SERVER_ERROR;

  // Build clean error response
  const responsePayload = {
    success: false,
    message: error.message,
    code: error.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
    errors: error.errors || []
  };

  // Only expose stack trace and debugging in development
  if (env.isDevelopment) {
    responsePayload.stack = err.stack;
    responsePayload.originalError = err.name;
  }

  res.status(statusCode).json(responsePayload);
};

module.exports = errorMiddleware;
