const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: [true, "Wallet ID is required"],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true
    },
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: [true, "Transaction type is required"]
    },
    amount: {
      type: Number,
      required: [true, "Transaction amount in minor units (paise) is required"],
      min: [1, "Transaction amount must be at least 1 paisa"],
      validate: {
        validator: Number.isInteger,
        message: "Transaction amount must be an integer minor unit (paise)"
      }
    },
    balanceBefore: {
      type: Number,
      required: [true, "Balance before transaction in minor units (paise) is required"],
      min: [0, "Balance before cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Balance before must be an integer minor unit (paise)"
      }
    },
    balanceAfter: {
      type: Number,
      required: [true, "Balance after transaction in minor units (paise) is required"],
      min: [0, "Balance after cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Balance after must be an integer minor unit (paise)"
      }
    },
    referenceType: {
      type: String,
      enum: [
        "ADMIN_CREDIT",
        "ADMIN_DEBIT",
        "PROMOTIONAL_CREDIT",
        "ORDER_CANCELLATION_CREDIT",
        "RETURN_CREDIT",
        "WALLET_PAYMENT",
        "REFERRAL_REWARD"
      ],
      required: [true, "Reference type is required"]
    },
    referenceId: {
      type: String,
      default: null,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false } // Immutable append-only ledger
  }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index(
  { referenceType: 1, referenceId: 1 },
  { unique: true, partialFilterExpression: { referenceId: { $type: "string" } } }
);

const WalletTransaction =
  mongoose.models.WalletTransaction ||
  mongoose.model("WalletTransaction", walletTransactionSchema);

module.exports = WalletTransaction;
