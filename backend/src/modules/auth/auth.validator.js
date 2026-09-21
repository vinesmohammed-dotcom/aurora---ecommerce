const { z } = require("zod");
const { OTP_PURPOSES } = require("./otp.model");

const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password cannot exceed 100 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name cannot exceed 50 characters"),
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  password: passwordRule
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  otp: z.string().trim().length(6, "OTP must be exactly 6 digits").regex(/^\d{6}$/, "OTP must contain only numbers"),
  purpose: z.enum([OTP_PURPOSES.REGISTRATION, OTP_PURPOSES.PASSWORD_RESET, OTP_PURPOSES.EMAIL_CHANGE], {
    errorMap: () => ({ message: "Invalid OTP verification purpose" })
  })
});

const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required")
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").toLowerCase()
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  otp: z.string().trim().length(6, "OTP must be exactly 6 digits").regex(/^\d{6}$/, "OTP must contain only numbers"),
  newPassword: passwordRule
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordRule
});

const changeEmailSchema = z.object({
  newEmail: z.string().trim().email("Please provide a valid email address").toLowerCase()
});

const verifyEmailChangeSchema = z.object({
  newEmail: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  otp: z.string().trim().length(6, "OTP must be exactly 6 digits").regex(/^\d{6}$/, "OTP must contain only numbers")
});

module.exports = {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  changeEmailSchema,
  verifyEmailChangeSchema
};
