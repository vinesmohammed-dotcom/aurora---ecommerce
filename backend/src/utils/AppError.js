const HTTP_CODES = require("../constants/httpCodes");
const ERROR_CODES = require("../constants/errorCodes");

/**
 * Custom Operational Application Error class
 */
class AppError extends Error {
  constructor(
    message,
    statusCode = HTTP_CODES.INTERNAL_SERVER_ERROR,
    code = ERROR_CODES.INTERNAL_SERVER_ERROR,
    errors = []
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true; // Distinguishes operational errors from unexpected runtime bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
