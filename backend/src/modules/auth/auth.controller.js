const AuthService = require("./auth.service");
const ApiResponse = require("../../utils/ApiResponse");
const HTTP_CODES = require("../../constants/httpCodes");
const asyncHandler = require("../../utils/asyncHandler");

/**
 * Register new user
 * POST /api/v1/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const result = await AuthService.register(req.body);
  new ApiResponse(HTTP_CODES.CREATED, result, result.message).send(res);
});

/**
 * Verify OTP code
 * POST /api/v1/auth/verify-otp
 */
const verifyOtp = asyncHandler(async (req, res) => {
  const result = await AuthService.verifyOtp(req.body);

  // If verifying registration, establish session with fixation protection
  if (result.user) {
    return req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }
      req.session.userId = result.user._id;
      req.session.role = result.user.role;
      req.session.authTime = Date.now();
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        new ApiResponse(HTTP_CODES.OK, result, result.message || "OTP verified successfully.").send(res);
      });
    });
  }

  new ApiResponse(HTTP_CODES.OK, result, result.message || "OTP verified successfully.").send(res);
});

/**
 * Login user
 * POST /api/v1/auth/login
 */
const login = asyncHandler(async (req, res, next) => {
  const user = await AuthService.login(req.body);

  // Defend against session fixation: generate fresh session ID and destroy pre-auth session
  req.session.regenerate((err) => {
    if (err) {
      return next(err);
    }
    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.authTime = Date.now();

    req.session.save((saveErr) => {
      if (saveErr) {
        return next(saveErr);
      }
      new ApiResponse(HTTP_CODES.OK, { user }, "Logged in successfully.").send(res);
    });
  });
});

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("[Session Destroy Error]", err);
    }
    res.clearCookie("sessionId");
    new ApiResponse(HTTP_CODES.OK, {}, "Logged out successfully.").send(res);
  });
});

/**
 * Get current authenticated user
 * GET /api/v1/auth/me
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  new ApiResponse(HTTP_CODES.OK, { user: req.user }, "Current user retrieved.").send(res);
});

/**
 * Forgot password
 * POST /api/v1/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const result = await AuthService.forgotPassword(req.body);
  new ApiResponse(HTTP_CODES.OK, {}, result.message).send(res);
});

/**
 * Reset password
 * POST /api/v1/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const result = await AuthService.resetPassword(req.body);
  new ApiResponse(HTTP_CODES.OK, {}, result.message).send(res);
});

/**
 * Change password (authenticated)
 * PATCH /api/v1/auth/password
 */
const changePassword = asyncHandler(async (req, res) => {
  const result = await AuthService.changePassword({
    userId: req.session.userId,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword
  });
  new ApiResponse(HTTP_CODES.OK, {}, result.message).send(res);
});

/**
 * Request email change (authenticated)
 * PATCH /api/v1/auth/email
 */
const requestEmailChange = asyncHandler(async (req, res) => {
  const result = await AuthService.requestEmailChange({
    userId: req.session.userId,
    currentEmail: req.user.email,
    newEmail: req.body.newEmail
  });
  new ApiResponse(HTTP_CODES.OK, {}, result.message).send(res);
});

/**
 * Verify email change OTP (authenticated)
 * POST /api/v1/auth/email/verify
 */
const verifyEmailChange = asyncHandler(async (req, res) => {
  const result = await AuthService.verifyEmailChange({
    userId: req.session.userId,
    newEmail: req.body.newEmail,
    otp: req.body.otp
  });
  new ApiResponse(HTTP_CODES.OK, { user: result.user }, result.message).send(res);
});

/**
 * Google OAuth Sign-In & Registration
 * POST /api/v1/auth/google
 */
const googleAuth = asyncHandler(async (req, res, next) => {
  const { user, isNew } = await AuthService.googleAuth({
    credential: req.body.credential,
    referralCode: req.body.referralCode
  });

  // Regenerate session ID to prevent session fixation attacks
  req.session.regenerate((err) => {
    if (err) {
      return next(err);
    }
    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.authTime = Date.now();

    req.session.save((saveErr) => {
      if (saveErr) {
        return next(saveErr);
      }
      new ApiResponse(
        isNew ? HTTP_CODES.CREATED : HTTP_CODES.OK,
        { user },
        isNew ? "Account created and signed in via Google successfully." : "Signed in via Google successfully."
      ).send(res);
    });
  });
});

module.exports = {
  register,
  verifyOtp,
  login,
  googleAuth,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  changePassword,
  requestEmailChange,
  verifyEmailChange
};
