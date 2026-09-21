import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import User from "../src/modules/users/user.model";
import { OTP, OTP_PURPOSES } from "../src/modules/auth/otp.model";

const TEST_DB_URI = "mongodb://127.0.0.1:27017/ecommerce_test_suite";

describe("Phase 2 — Authentication & User Management (Comprehensive Integration Tests)", () => {
  beforeAll(async () => {
    // Connect to live test database on MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    // Clean test collections
    await User.deleteMany({});
    await OTP.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data and disconnect cleanly
    await User.deleteMany({});
    await OTP.deleteMany({});
    await mongoose.disconnect();
  });

  // ============================================================================
  // 1. REGISTRATION & INPUT VALIDATION
  // ============================================================================
  describe("Registration Flow", () => {
    it("should successfully initiate registration and dispatch OTP for valid input", async () => {
      const response = await request(app).post("/api/v1/auth/register").send({
        name: "Test User",
        email: "test.user@example.com",
        password: "Password123!"
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Registration initiated");

      // Verify unverified user in database
      const user = await User.findOne({ email: "test.user@example.com" });
      expect(user).toBeTruthy();
      expect(user.isVerified).toBe(false);

      // Verify OTP created in database with SHA-256 hash
      const otp = await OTP.findOne({ email: "test.user@example.com", purpose: OTP_PURPOSES.REGISTRATION });
      expect(otp).toBeTruthy();
      expect(otp.hashedOtp).toBeTruthy();
      expect(otp.isUsed).toBe(false);
    });

    it("should reject invalid registration input via Zod validation", async () => {
      const response = await request(app).post("/api/v1/auth/register").send({
        name: "A", // Min 2 chars
        email: "not-an-email",
        password: "short" // Min 8 chars, needs number & uppercase
      });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(response.body.errors.length).toBeGreaterThanOrEqual(3);
    });

    it("should reject duplicate registration if email is already verified", async () => {
      // First verify the user
      await User.updateOne({ email: "test.user@example.com" }, { isVerified: true });

      const response = await request(app).post("/api/v1/auth/register").send({
        name: "Test Duplicate",
        email: "test.user@example.com",
        password: "Password123!"
      });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("DUPLICATE_FIELD");
    });
  });

  // ============================================================================
  // 2. OTP VERIFICATION & EDGE CASES
  // ============================================================================
  describe("OTP Verification Flow", () => {
    let plainOtpCode = "654321";

    beforeAll(async () => {
      // Create user needing verification
      await User.create({
        name: "OTP User",
        email: "otp.user@example.com",
        passwordHash: await User.hashPassword("Password123!"),
        isVerified: false
      });

      // Create known OTP
      await OTP.create({
        email: "otp.user@example.com",
        purpose: OTP_PURPOSES.REGISTRATION,
        hashedOtp: OTP.hashOtp(plainOtpCode),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
    });

    it("should reject incorrect OTP with attempts remaining countdown", async () => {
      const response = await request(app).post("/api/v1/auth/verify-otp").send({
        email: "otp.user@example.com",
        otp: "000000",
        purpose: OTP_PURPOSES.REGISTRATION
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("attempt(s) remaining");

      const otp = await OTP.findOne({ email: "otp.user@example.com", purpose: OTP_PURPOSES.REGISTRATION });
      expect(otp.attempts).toBe(1);
    });

    it("should reject expired OTP", async () => {
      await OTP.updateOne(
        { email: "otp.user@example.com", purpose: OTP_PURPOSES.REGISTRATION },
        { expiresAt: new Date(Date.now() - 1000) } // Expired 1s ago
      );

      const response = await request(app).post("/api/v1/auth/verify-otp").send({
        email: "otp.user@example.com",
        otp: plainOtpCode,
        purpose: OTP_PURPOSES.REGISTRATION
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("expired");
    });

    it("should lock out OTP after exceeding 5 attempts", async () => {
      // Create fresh OTP with 5 attempts already recorded
      await OTP.create({
        email: "attempt.limit@example.com",
        purpose: OTP_PURPOSES.REGISTRATION,
        hashedOtp: OTP.hashOtp("112233"),
        attempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      const response = await request(app).post("/api/v1/auth/verify-otp").send({
        email: "attempt.limit@example.com",
        otp: "112233",
        purpose: OTP_PURPOSES.REGISTRATION
      });

      expect(response.status).toBe(429);
      expect(response.body.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("should successfully verify valid OTP, activate user, and set session cookie", async () => {
      const validCode = "987654";
      await OTP.create({
        email: "otp.user@example.com",
        purpose: OTP_PURPOSES.REGISTRATION,
        hashedOtp: OTP.hashOtp(validCode),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      const response = await request(app).post("/api/v1/auth/verify-otp").send({
        email: "otp.user@example.com",
        otp: validCode,
        purpose: OTP_PURPOSES.REGISTRATION
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe("otp.user@example.com");

      // Verify user is now activated
      const user = await User.findOne({ email: "otp.user@example.com" });
      expect(user.isVerified).toBe(true);

      // Verify OTP is marked consumed (single-use)
      const otp = await OTP.findOne({ email: "otp.user@example.com", hashedOtp: OTP.hashOtp(validCode) });
      expect(otp.isUsed).toBe(true);

      // Verify session cookie was issued
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain("sessionId=");
    });

    it("should prevent OTP reuse (cannot reuse already consumed OTP)", async () => {
      const response = await request(app).post("/api/v1/auth/verify-otp").send({
        email: "otp.user@example.com",
        otp: "987654",
        purpose: OTP_PURPOSES.REGISTRATION
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Invalid or expired verification code");
    });
  });

  // ============================================================================
  // 3. LOGIN, LOGOUT & SESSION LIFECYCLE
  // ============================================================================
  describe("Login & Session Management Flow", () => {
    let authCookie = "";

    beforeAll(async () => {
      // 1. Normal verified user
      await User.create({
        name: "Login User",
        email: "login.user@example.com",
        passwordHash: await User.hashPassword("Password123!"),
        isVerified: true,
        isBlocked: false,
        role: "USER"
      });

      // 2. Unverified user
      await User.create({
        name: "Unverified User",
        email: "unverified@example.com",
        passwordHash: await User.hashPassword("Password123!"),
        isVerified: false,
        isBlocked: false
      });

      // 3. Blocked user
      await User.create({
        name: "Blocked User",
        email: "blocked@example.com",
        passwordHash: await User.hashPassword("Password123!"),
        isVerified: true,
        isBlocked: true
      });
    });

    it("should reject login with wrong password", async () => {
      const response = await request(app).post("/api/v1/auth/login").send({
        email: "login.user@example.com",
        password: "WrongPassword!"
      });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED");
      expect(response.body.message).toBe("Invalid email or password.");
    });

    it("should reject unverified user at login with 403 Forbidden", async () => {
      const response = await request(app).post("/api/v1/auth/login").send({
        email: "unverified@example.com",
        password: "Password123!"
      });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
      expect(response.body.message).toContain("verification pending");
    });

    it("should reject suspended/blocked user at login with 403 Forbidden", async () => {
      const response = await request(app).post("/api/v1/auth/login").send({
        email: "blocked@example.com",
        password: "Password123!"
      });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
      expect(response.body.message).toContain("suspended");
    });

    it("should login successfully, return safe user object, and set session cookie", async () => {
      const response = await request(app).post("/api/v1/auth/login").send({
        email: "login.user@example.com",
        password: "Password123!"
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe("login.user@example.com");
      expect(response.body.data.user).not.toHaveProperty("passwordHash"); // Never leak hash!

      // Capture session cookie for subsequent protected tests
      authCookie = response.headers["set-cookie"][0];
      expect(authCookie).toContain("sessionId=");
    });

    it("GET /api/v1/auth/me should return current user when session cookie is provided", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe("login.user@example.com");
    });

    it("GET /api/v1/auth/me should reject request without session cookie with 401 Unauthorized", async () => {
      const response = await request(app).get("/api/v1/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED");
    });

    it("POST /api/v1/auth/logout should destroy session and clear session cookie", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify cookie is cleared
      const cookies = response.headers["set-cookie"][0];
      expect(cookies).toContain("sessionId=;");
    });
  });

  // ============================================================================
  // 4. PASSWORD & EMAIL MANAGEMENT WORKFLOWS
  // ============================================================================
  describe("Password & Email Update Flows", () => {
    let userCookie = "";
    let userId = "";

    beforeAll(async () => {
      const user = await User.create({
        name: "Security User",
        email: "security@example.com",
        passwordHash: await User.hashPassword("OriginalPassword123!"),
        isVerified: true,
        role: "USER"
      });
      userId = user._id.toString();

      // Login to obtain session cookie
      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: "security@example.com",
        password: "OriginalPassword123!"
      });
      userCookie = loginRes.headers["set-cookie"][0];
    });

    it("should return uniform response for forgot password to prevent enumeration", async () => {
      const response = await request(app).post("/api/v1/auth/forgot-password").send({
        email: "security@example.com"
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("If an active account is registered");

      // Verify reset OTP created
      const resetOtp = await OTP.findOne({ email: "security@example.com", purpose: OTP_PURPOSES.PASSWORD_RESET });
      expect(resetOtp).toBeTruthy();
    });

    it("should successfully reset password with valid OTP", async () => {
      const otpCode = "554433";
      await OTP.create({
        email: "security@example.com",
        purpose: OTP_PURPOSES.PASSWORD_RESET,
        hashedOtp: OTP.hashOtp(otpCode),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      const response = await request(app).post("/api/v1/auth/reset-password").send({
        email: "security@example.com",
        otp: otpCode,
        newPassword: "NewResetPassword123!"
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Password reset successful");

      // Verify user can now log in with new password
      const testLogin = await request(app).post("/api/v1/auth/login").send({
        email: "security@example.com",
        password: "NewResetPassword123!"
      });
      expect(testLogin.status).toBe(200);
    });

    it("should change password when authenticated and current password matches", async () => {
      // Re-login to get fresh cookie after reset
      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: "security@example.com",
        password: "NewResetPassword123!"
      });
      const activeCookie = loginRes.headers["set-cookie"][0];

      const response = await request(app)
        .patch("/api/v1/auth/password")
        .set("Cookie", activeCookie)
        .send({
          currentPassword: "NewResetPassword123!",
          newPassword: "BrandNewPassword123!"
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Password updated successfully");
    });

    it("should request email change and send OTP to new email address", async () => {
      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: "security@example.com",
        password: "BrandNewPassword123!"
      });
      const activeCookie = loginRes.headers["set-cookie"][0];

      const response = await request(app)
        .patch("/api/v1/auth/email")
        .set("Cookie", activeCookie)
        .send({
          newEmail: "brandnew.email@example.com"
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Verification code sent to brandnew.email@example.com");

      // Verify OTP stored for new email
      const emailOtp = await OTP.findOne({ email: "brandnew.email@example.com", purpose: OTP_PURPOSES.EMAIL_CHANGE });
      expect(emailOtp).toBeTruthy();
    });

    it("should reject email change if requested email is already taken", async () => {
      await User.create({
        name: "Existing Other",
        email: "already.taken@example.com",
        passwordHash: await User.hashPassword("Password123!"),
        isVerified: true
      });

      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: "security@example.com",
        password: "BrandNewPassword123!"
      });
      const activeCookie = loginRes.headers["set-cookie"][0];

      const response = await request(app)
        .patch("/api/v1/auth/email")
        .set("Cookie", activeCookie)
        .send({
          newEmail: "already.taken@example.com"
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("DUPLICATE_FIELD");
    });
  });

  // ============================================================================
  // 5. USER PROFILE & IDENTITY ASSURANCE
  // ============================================================================
  describe("User Profile Management Flow", () => {
    let profileCookie = "";

    beforeAll(async () => {
      await User.create({
        name: "Profile User",
        email: "profile.user@example.com",
        passwordHash: await User.hashPassword("Password123!"),
        isVerified: true
      });

      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: "profile.user@example.com",
        password: "Password123!"
      });
      profileCookie = loginRes.headers["set-cookie"][0];
    });

    it("GET /api/v1/users/me should retrieve authenticated profile", async () => {
      const response = await request(app)
        .get("/api/v1/users/me")
        .set("Cookie", profileCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.user.name).toBe("Profile User");
      expect(response.body.data.user.email).toBe("profile.user@example.com");
    });

    it("PATCH /api/v1/users/me should update profile fields safely", async () => {
      const response = await request(app)
        .patch("/api/v1/users/me")
        .set("Cookie", profileCookie)
        .send({
          name: "Updated Profile Name",
          phone: "9876543210"
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user.name).toBe("Updated Profile Name");

      // Verify in DB
      const updatedUser = await User.findOne({ email: "profile.user@example.com" });
      expect(updatedUser.name).toBe("Updated Profile Name");
    });
  });
});
