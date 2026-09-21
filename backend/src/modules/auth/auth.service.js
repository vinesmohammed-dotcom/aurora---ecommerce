const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../users/user.model");
const { OTP, OTP_PURPOSES } = require("./otp.model");
const EmailService = require("../../services/email.service");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class AuthService {
  /**
   * Register a new user and dispatch verification OTP
   */
  static async register({ name, email, password }) {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.isVerified) {
        throw new AppError(
          "An account with this email address already exists.",
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }
      // If user exists but is unverified, update their details and re-issue OTP
      existingUser.name = name;
      existingUser.passwordHash = await User.hashPassword(password);
      await existingUser.save();
    } else {
      const passwordHash = await User.hashPassword(password);
      await User.create({
        name,
        email,
        passwordHash,
        isVerified: false
      });
    }

    // Invalidate any active, unused registration OTPs for this email
    await OTP.updateMany(
      { email, purpose: OTP_PURPOSES.REGISTRATION, isUsed: false },
      { $set: { isUsed: true } }
    );

    // Generate secure 6-digit OTP using server-secret keyed HMAC
    const { plainOtp, hashedOtp } = OTP.generateOtp({
      purpose: OTP_PURPOSES.REGISTRATION,
      email
    });

    await OTP.create({
      email,
      purpose: OTP_PURPOSES.REGISTRATION,
      hashedOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });

    // Send email asynchronously
    await EmailService.sendOtpEmail({
      to: email,
      otp: plainOtp,
      purpose: OTP_PURPOSES.REGISTRATION
    });

    return {
      email,
      message: "Registration initiated. Please verify the 6-digit code sent to your email."
    };
  }

  /**
   * Verify OTP and activate account or authorize purpose
   */
  static async verifyOtp({ email, otp, purpose }) {
    const otpDoc = await OTP.findOne({
      email,
      purpose,
      isUsed: false
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      throw new AppError(
        "Invalid or expired verification code.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check expiration
    if (new Date() > otpDoc.expiresAt) {
      otpDoc.isUsed = true;
      await otpDoc.save();
      throw new AppError(
        "Verification code has expired. Please request a new code.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check attempt limit
    if (otpDoc.attempts >= 5) {
      otpDoc.isUsed = true;
      await otpDoc.save();
      throw new AppError(
        "Maximum verification attempts exceeded. Please request a new code.",
        HTTP_CODES.TOO_MANY_REQUESTS,
        ERROR_CODES.RATE_LIMIT_EXCEEDED
      );
    }

    // Increment attempt counter
    otpDoc.attempts += 1;

    // Constant-time hash verification using server-secret keyed HMAC
    const isValid = OTP.verifyHash(otp, otpDoc.hashedOtp, {
      purpose: otpDoc.purpose,
      email: otpDoc.email
    });

    if (!isValid) {
      await otpDoc.save();
      const remaining = 5 - otpDoc.attempts;
      throw new AppError(
        `Incorrect verification code. ${remaining} attempt(s) remaining.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Mark OTP as consumed (single-use enforcement)
    otpDoc.isUsed = true;
    await otpDoc.save();

    // Purpose-specific side effects
    if (purpose === OTP_PURPOSES.REGISTRATION) {
      const user = await User.findOne({ email });
      if (!user) {
        throw new AppError("Account not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
      }
      user.isVerified = true;
      await user.save();
      return { user, message: "Account verified successfully." };
    }

    return { verified: true, email };
  }

  /**
   * Authenticate user credentials and return safe user record
   */
  static async login({ email, password }) {
    const user = await User.findOne({ email }).select("+passwordHash");

    // Defend against timing-based account enumeration:
    // If user is not found, run a dummy bcrypt compare to keep execution time identical
    if (!user) {
      await bcrypt.compare(password, "$2a$12$e8p4sY9rL5q2O6jL7u8v9e0w1x2y3z4a5b6c7d8e9f0g1h2i3j4k");
      throw new AppError(
        "Invalid email or password.",
        HTTP_CODES.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      throw new AppError(
        "Invalid email or password.",
        HTTP_CODES.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    if (user.isBlocked) {
      throw new AppError(
        "Your account has been suspended by an administrator.",
        HTTP_CODES.FORBIDDEN,
        ERROR_CODES.FORBIDDEN
      );
    }

    if (!user.isVerified) {
      throw new AppError(
        "Account email verification pending. Please verify your OTP to continue.",
        HTTP_CODES.FORBIDDEN,
        ERROR_CODES.FORBIDDEN
      );
    }

    return user;
  }

  /**
   * Initiate forgot password flow with constant response to prevent enumeration
   */
  static async forgotPassword({ email }) {
    const user = await User.findOne({ email });

    if (user && !user.isBlocked && user.isVerified) {
      // Invalidate existing unused password reset OTPs
      await OTP.updateMany(
        { email, purpose: OTP_PURPOSES.PASSWORD_RESET, isUsed: false },
        { $set: { isUsed: true } }
      );

      const { plainOtp, hashedOtp } = OTP.generateOtp({
        purpose: OTP_PURPOSES.PASSWORD_RESET,
        email
      });

      await OTP.create({
        email,
        purpose: OTP_PURPOSES.PASSWORD_RESET,
        hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });

      await EmailService.sendOtpEmail({
        to: email,
        otp: plainOtp,
        purpose: OTP_PURPOSES.PASSWORD_RESET
      });
    }

    // Always return identical message regardless of whether the email exists
    return {
      message: "If an active account is registered with this email, a verification code has been dispatched."
    };
  }

  /**
   * Reset password via verified OTP and invalidate old sessions
   */
  static async resetPassword({ email, otp, newPassword }) {
    // 1. Verify OTP
    await this.verifyOtp({ email, otp, purpose: OTP_PURPOSES.PASSWORD_RESET });

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("Account not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // 2. Hash and update password
    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();

    // 3. Invalidate active sessions for this user in MongoDB sessions collection
    try {
      if (mongoose.connection.readyState === 1) {
        const sessionsCollection = mongoose.connection.collection("sessions");
        // Regex search for userId inside session JSON string
        await sessionsCollection.deleteMany({ session: new RegExp(user._id.toString()) });
      }
    } catch (err) {
      console.warn("[Session Revocation Notice] Could not invalidate existing sessions:", err.message);
    }

    return {
      message: "Password reset successful. Please log in with your new credentials."
    };
  }

  /**
   * Change password for authenticated user
   */
  static async changePassword({ userId, currentPassword, newPassword }) {
    const user = await User.findById(userId).select("+passwordHash");

    if (!user) {
      throw new AppError("Account not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError(
        "Current password does not match.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();

    return { message: "Password updated successfully." };
  }

  /**
   * Request email change: sends OTP to new email address
   */
  static async requestEmailChange({ userId, newEmail }) {
    const existing = await User.findOne({ email: newEmail });
    if (existing) {
      throw new AppError(
        "The requested email address is already in use by another account.",
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }

    await OTP.updateMany(
      { email: newEmail, purpose: OTP_PURPOSES.EMAIL_CHANGE, isUsed: false },
      { $set: { isUsed: true } }
    );

    const { plainOtp, hashedOtp } = OTP.generateOtp({
      purpose: OTP_PURPOSES.EMAIL_CHANGE,
      email: newEmail
    });

    await OTP.create({
      email: newEmail,
      purpose: OTP_PURPOSES.EMAIL_CHANGE,
      hashedOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    await EmailService.sendOtpEmail({
      to: newEmail,
      otp: plainOtp,
      purpose: OTP_PURPOSES.EMAIL_CHANGE
    });

    return { message: `Verification code sent to ${newEmail}.` };
  }

  /**
   * Verify email change OTP and update user document
   */
  static async verifyEmailChange({ userId, newEmail, otp }) {
    await this.verifyOtp({ email: newEmail, otp, purpose: OTP_PURPOSES.EMAIL_CHANGE });

    const duplicateCheck = await User.findOne({ email: newEmail });
    if (duplicateCheck && duplicateCheck._id.toString() !== userId.toString()) {
      throw new AppError(
        "The requested email address is already in use by another account.",
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { email: newEmail },
      { new: true }
    );

    return { user: updatedUser, message: "Email address updated successfully." };
  }
}

module.exports = AuthService;
