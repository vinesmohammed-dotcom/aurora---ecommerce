const mongoose = require("mongoose");
const crypto = require("crypto");
const env = require("../../config/env");

const OTP_PURPOSES = Object.freeze({
  REGISTRATION: "REGISTRATION",
  PASSWORD_RESET: "PASSWORD_RESET",
  EMAIL_CHANGE: "EMAIL_CHANGE"
});

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    lowercase: true,
    trim: true
  },
  purpose: {
    type: String,
    enum: Object.values(OTP_PURPOSES),
    required: [true, "OTP purpose is required"]
  },
  hashedOtp: {
    type: String,
    required: [true, "Hashed OTP is required"]
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes lifetime
  },
  attempts: {
    type: Number,
    default: 0,
    max: [5, "Maximum OTP verification attempts exceeded"]
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL Index: MongoDB automatically purges documents when expiresAt timestamp is reached
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound Index for fast lookup by email and purpose
otpSchema.index({ email: 1, purpose: 1, isUsed: 1 });

/**
 * Retrieve the secret key used for HMAC-SHA256
 * @returns {string}
 */
const getOtpSecret = () => {
  return env.OTP_SECRET || env.SESSION_SECRET || "dev_otp_hmac_secret_key_minimum_32_characters_long!";
};

/**
 * Hash a plain OTP string using server-secret keyed HMAC-SHA256 bound to purpose and email
 * HMAC(serverSecret, OTP + ":" + purpose + ":" + email)
 * @param {string} plainOtp
 * @param {{ purpose: string, email: string }} context
 * @returns {string} HMAC-SHA256 hex digest
 */
otpSchema.statics.hashOtp = function (plainOtp, { purpose, email }) {
  if (!purpose || !email) {
    throw new Error("OTP hashing requires both purpose and email context");
  }
  const message = `${plainOtp.toString().trim()}:${purpose}:${email.toString().toLowerCase().trim()}`;
  return crypto.createHmac("sha256", getOtpSecret()).update(message).digest("hex");
};

/**
 * Generate a cryptographically secure 6-digit OTP and its keyed HMAC-SHA256 hash
 * @param {{ purpose: string, email: string }} context
 * @returns {{ plainOtp: string, hashedOtp: string }}
 */
otpSchema.statics.generateOtp = function ({ purpose, email }) {
  const plainOtp = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = this.hashOtp(plainOtp, { purpose, email });
  return { plainOtp, hashedOtp };
};

/**
 * Constant-time comparison between submitted plain OTP and stored keyed HMAC hash
 * Verification flow:
 * 1. Recreate keyed digest using serverSecret, plainOtp, purpose, and email
 * 2. Constant-time comparison via crypto.timingSafeEqual
 * @param {string} plainOtp
 * @param {string} storedHash
 * @param {{ purpose: string, email: string }} context
 * @returns {boolean}
 */
otpSchema.statics.verifyHash = function (plainOtp, storedHash, { purpose, email }) {
  if (!plainOtp || !storedHash || !purpose || !email) {
    return false;
  }
  const candidateHash = this.hashOtp(plainOtp, { purpose, email });
  if (candidateHash.length !== storedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(candidateHash, "utf8"), Buffer.from(storedHash, "utf8"));
};

const OTP = mongoose.models.OTP || mongoose.model("OTP", otpSchema);

module.exports = {
  OTP,
  OTP_PURPOSES
};
