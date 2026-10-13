const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
    },
    passwordHash: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      select: false // Never return passwordHash in queries by default
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true
    },
    authProvider: {
      type: String,
      enum: ["LOCAL", "GOOGLE"],
      default: "LOCAL"
    },
    avatar: {
      type: String,
      default: null
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    role: {
      type: String,
      enum: {
        values: ["USER", "ADMIN"],
        message: "Role must be either USER or ADMIN"
      },
      default: "USER"
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    passwordChangedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Auto-generate unique referral code if missing
userSchema.pre("save", function (next) {
  if (!this.referralCode) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.referralCode = `AUR-${randomHex}`;
  }
  next();
});

// Indexes
userSchema.index({ role: 1 });

/**
 * Compare candidate password with stored bcrypt hash
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Static helper to hash plaintext password using bcrypt (12 salt rounds)
 * @param {string} plaintextPassword
 * @returns {Promise<string>}
 */
userSchema.statics.hashPassword = async function (plaintextPassword) {
  return bcrypt.hash(plaintextPassword, 12);
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
