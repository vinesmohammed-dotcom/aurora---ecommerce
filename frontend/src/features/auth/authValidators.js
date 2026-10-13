import { z } from "zod";

/**
 * Common password complexity rule matching backend security requirements:
 * Min 8 chars, Max 100 chars, at least 1 uppercase letter, at least 1 number.
 */
export const passwordRule = z
  .string()
  .min(1, "Password is required")
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password cannot exceed 100 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Sign In Form Validation Schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Please provide a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
});

/**
 * Registration Form Validation Schema
 */
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Please provide a valid email address"),
  password: passwordRule,
  referralCode: z.string().trim().max(20).optional().or(z.literal(""))
});

/**
 * OTP Verification Schema
 */
export const verifyOtpSchema = z.object({
  otp: z
    .string()
    .trim()
    .min(1, "OTP code is required")
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only numbers")
});

/**
 * Forgot Password Request Schema
 */
export const forgotPasswordRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Please provide a valid email address")
});

/**
 * Reset Password Submit Schema
 */
export const resetPasswordSubmitSchema = z
  .object({
    otp: z
      .string()
      .trim()
      .min(1, "OTP code is required")
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d{6}$/, "OTP must contain only numbers"),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, "Please confirm your password")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });
