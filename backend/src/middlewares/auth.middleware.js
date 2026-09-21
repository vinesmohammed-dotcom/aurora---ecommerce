const User = require("../modules/users/user.model");
const AppError = require("../utils/AppError");
const HTTP_CODES = require("../constants/httpCodes");
const ERROR_CODES = require("../constants/errorCodes");

/**
 * Authentication Middleware: requireAuth
 * Verifies active session, checks account status, and attaches authenticated user to req.user.
 */
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return next(
        new AppError(
          "Authentication required. Please log in to continue.",
          HTTP_CODES.UNAUTHORIZED,
          ERROR_CODES.UNAUTHORIZED
        )
      );
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      // User was deleted while session was active
      req.session.destroy(() => {});
      res.clearCookie("sessionId");
      return next(
        new AppError(
          "The account associated with this session no longer exists.",
          HTTP_CODES.UNAUTHORIZED,
          ERROR_CODES.UNAUTHORIZED
        )
      );
    }

    if (user.isBlocked) {
      // Banned account: immediately invalidate session
      req.session.destroy(() => {});
      res.clearCookie("sessionId");
      return next(
        new AppError(
          "Your account has been suspended by an administrator.",
          HTTP_CODES.FORBIDDEN,
          ERROR_CODES.FORBIDDEN
        )
      );
    }

    if (!user.isVerified) {
      return next(
        new AppError(
          "Account email verification pending. Please verify your OTP to continue.",
          HTTP_CODES.FORBIDDEN,
          ERROR_CODES.FORBIDDEN
        )
      );
    }

    // Attach safe user document to request context
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-Based Authorization Middleware: requireRole
 * Enforces role access boundaries (e.g. ADMIN).
 *
 * @param {...string} allowedRoles - Array of permitted roles ('USER' | 'ADMIN')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError(
          "Authentication context missing. Ensure requireAuth runs before requireRole.",
          HTTP_CODES.INTERNAL_SERVER_ERROR,
          ERROR_CODES.INTERNAL_SERVER_ERROR
        )
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not possess the required permissions to access this administrative resource.",
          HTTP_CODES.FORBIDDEN,
          ERROR_CODES.FORBIDDEN
        )
      );
    }

    next();
  };
};

module.exports = {
  requireAuth,
  requireRole
};
