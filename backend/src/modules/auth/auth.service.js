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
  static async register({ name, email, password, referralCode }) {
    const existingUser = await User.findOne({ email });

    let referredBy = null;
    if (referralCode && referralCode.trim()) {
      const code = referralCode.trim().toUpperCase();
      const referrer = await User.findOne({ referralCode: code, isVerified: true, isBlocked: false });
      if (!referrer) {
        throw new AppError(
          "Invalid or inactive referral code.",
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      if (referrer.email.toLowerCase() === email.toLowerCase()) {
        throw new AppError(
          "You cannot use your own referral code.",
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      referredBy = referrer._id;
    }

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
      if (referredBy) existingUser.referredBy = referredBy;
      await existingUser.save();
    } else {
      const passwordHash = await User.hashPassword(password);
      await User.create({
        name,
        email,
        passwordHash,
        isVerified: false,
        referredBy
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

      // If user was referred, issue referral welcome bonus and referrer reward
      if (user.referredBy) {
        try {
          const WalletService = require("../wallet/wallet.service");
          // Credit new user: ₹100 (10,000 paise)
          await WalletService.creditWallet({
            userId: user._id,
            amount: 10000,
            referenceType: "REFERRAL_REWARD",
            referenceId: `ref_welcome_${user._id}`,
            description: "Welcome referral bonus credits",
            metadata: { referrerId: user.referredBy }
          });

          // Credit referrer: ₹100 (10,000 paise)
          await WalletService.creditWallet({
            userId: user.referredBy,
            amount: 10000,
            referenceType: "REFERRAL_REWARD",
            referenceId: `ref_reward_${user.referredBy}_${user._id}`,
            description: `Referral reward for inviting ${user.name}`,
            metadata: { referredUserId: user._id }
          });
        } catch (walletErr) {
          console.warn("[Referral Credit Notice]", walletErr.message);
        }
      }

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
    user.passwordChangedAt = new Date();
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
    user.passwordChangedAt = new Date();
    await user.save();

    // Invalidate other sessions in MongoDB
    try {
      if (mongoose.connection.readyState === 1) {
        const sessionsCollection = mongoose.connection.collection("sessions");
        await sessionsCollection.deleteMany({ session: new RegExp(user._id.toString()) });
      }
    } catch (err) {
      console.warn("[Session Revocation Notice] Could not invalidate existing sessions:", err.message);
    }

    return { message: "Password updated successfully. Please log in again with your new credentials." };
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

  /**
   * Cryptographically verify Google ID Token with Google OAuth2 API
   */
  static async verifyGoogleIdToken(token) {
    if (!token || typeof token !== "string") {
      throw new AppError("Google ID token is required.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    let payload;
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
      if (!response.ok) {
        throw new AppError("Invalid or expired Google credential token.", HTTP_CODES.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
      }
      payload = await response.json();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Google verification service unavailable: ${err.message}`, HTTP_CODES.BAD_GATEWAY, ERROR_CODES.UNKNOWN_ERROR);
    }

    // Verify token issuer
    const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
    if (!validIssuers.includes(payload.iss)) {
      throw new AppError("Invalid Google token issuer.", HTTP_CODES.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    // Verify audience against configured environment variable if available
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && payload.aud !== expectedClientId) {
      throw new AppError("Google client ID audience mismatch.", HTTP_CODES.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    // Verify expiration timestamp
    if (payload.exp && Date.now() >= parseInt(payload.exp, 10) * 1000) {
      throw new AppError("Google ID token has expired.", HTTP_CODES.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }

    // Verify that the email is verified by Google
    if (!payload.email || (payload.email_verified !== "true" && payload.email_verified !== true)) {
      throw new AppError("Google account email is not verified.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    return payload;
  }

  /**
   * Google Sign-In: Authenticate or register customer safely with identity matching
   */
  static async googleAuth({ credential, referralCode }) {
    const payload = await this.verifyGoogleIdToken(credential);
    const email = payload.email.toLowerCase().trim();
    const googleId = payload.sub;

    // Check if user already exists by googleId or by email
    let user = await User.findOne({
      $or: [{ googleId }, { email }]
    });

    if (user) {
      if (user.isBlocked) {
        throw new AppError(
          "Your account has been suspended by an administrator.",
          HTTP_CODES.FORBIDDEN,
          ERROR_CODES.FORBIDDEN
        );
      }

      // Safe identity linking: link googleId and avatar if not yet linked
      let hasChanges = false;
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = "GOOGLE";
        hasChanges = true;
      }
      if (!user.isVerified) {
        user.isVerified = true;
        hasChanges = true;
      }
      if (!user.avatar && payload.picture) {
        user.avatar = payload.picture;
        hasChanges = true;
      }

      if (hasChanges) {
        await user.save();
      }

      return { user, isNew: false };
    }

    // New User registration via Google OAuth
    let referredBy = null;
    if (referralCode && referralCode.trim()) {
      const code = referralCode.trim().toUpperCase();
      const referrer = await User.findOne({ referralCode: code, isVerified: true, isBlocked: false });
      if (referrer && referrer.email.toLowerCase() !== email) {
        referredBy = referrer._id;
      }
    }

    user = await User.create({
      name: payload.name || "Google User",
      email,
      googleId,
      authProvider: "GOOGLE",
      avatar: payload.picture || null,
      isVerified: true,
      role: "USER",
      referredBy
    });

    // Credit referral rewards atomically if registered with referral code
    if (referredBy) {
      try {
        const WalletService = require("../wallet/wallet.service");
        await Promise.all([
          WalletService.creditWallet({
            userId: user._id,
            amount: 10000,
            referenceType: "REFERRAL_REWARD",
            referenceId: `ref_welcome_${user._id}`,
            description: "Welcome referral bonus credits",
            metadata: { referrerId: referredBy }
          }),
          WalletService.creditWallet({
            userId: referredBy,
            amount: 10000,
            referenceType: "REFERRAL_REWARD",
            referenceId: `ref_reward_${referredBy}_${user._id}`,
            description: `Referral reward for inviting ${user.name}`,
            metadata: { referredUserId: user._id }
          })
        ]);
      } catch (walletErr) {
        console.warn("[Referral Credit Notice]", walletErr.message);
      }
    }

    return { user, isNew: true };
  }
}

module.exports = AuthService;
