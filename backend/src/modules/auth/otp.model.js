const mongoose = require("mongoose");
const crypto = require("crypto");

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
 * Generate a cryptographically secure 6-digit OTP and its SHA-256 hash
 * @returns {{ plainOtp: string, hashedOtp: string }}
 */
otpSchema.statics.generateOtp = function () {
  const plainOtp = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = crypto.createHash("sha256").update(plainOtp).digest("hex");
  return { plainOtp, hashedOtp };
};

/**
 * Hash a plain OTP string using SHA-256
 * @param {string} plainOtp
 * @returns {string} SHA-256 hex string
 */
otpSchema.statics.hashOtp = function (plainOtp) {
  return crypto.createHash("sha256").update(plainOtp).digest("hex");
};

/**
 * Constant-time comparison between submitted plain OTP and stored hash
 * @param {string} plainOtp
 * @param {string} storedHash
 * @returns {boolean}
 */
otpSchema.statics.verifyHash = function (plainOtp, storedHash) {
  const candidateHash = crypto.createHash("sha256").update(plainOtp).digest("hex");
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
