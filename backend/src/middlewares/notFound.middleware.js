const AppError = require("../utils/AppError");
const HTTP_CODES = require("../constants/httpCodes");
const ERROR_CODES = require("../constants/errorCodes");

/**
 * 404 Route Not Found Middleware
 */
const notFoundMiddleware = (req, res, next) => {
  next(
    new AppError(
      `Cannot find endpoint ${req.method} ${req.originalUrl} on this server`,
      HTTP_CODES.NOT_FOUND,
      ERROR_CODES.NOT_FOUND
    )
  );
};

module.exports = notFoundMiddleware;
