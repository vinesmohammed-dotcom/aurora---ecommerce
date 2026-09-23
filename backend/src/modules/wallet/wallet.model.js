const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
      index: true
    },
    balance: {
      type: Number,
      required: [true, "Wallet balance in minor units (paise) is required"],
      default: 0,
      min: [0, "Wallet balance cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Wallet balance must be an integer minor unit (paise)"
      }
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const Wallet = mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);

module.exports = Wallet;
