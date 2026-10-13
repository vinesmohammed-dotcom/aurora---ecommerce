const { Router } = require("express");
const authController = require("./auth.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { authLimiter, otpLimiter } = require("../../middlewares/rateLimiter.middleware");
const {
  registerSchema,
  googleAuthSchema,
  verifyOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  changeEmailSchema,
  verifyEmailChangeSchema
} = require("./auth.validator");

const router = Router();

// Public Authentication Endpoints
router.post("/register", otpLimiter, validate(registerSchema), authController.register);
router.post("/verify-otp", otpLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/google", authLimiter, validate(googleAuthSchema), authController.googleAuth);
router.post("/logout", authController.logout);
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Protected Authentication Endpoints
router.get("/me", requireAuth, authController.getCurrentUser);
router.patch("/password", requireAuth, validate(changePasswordSchema), authController.changePassword);
router.patch("/email", requireAuth, otpLimiter, validate(changeEmailSchema), authController.requestEmailChange);
router.post("/email/verify", requireAuth, otpLimiter, validate(verifyEmailChangeSchema), authController.verifyEmailChange);

module.exports = router;
