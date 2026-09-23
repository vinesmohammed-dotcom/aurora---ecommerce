const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order ID is required"],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true
    },
    gateway: {
      type: String,
      enum: ["RAZORPAY"],
      default: "RAZORPAY",
      required: true
    },
    gatewayOrderId: {
      type: String,
      required: [true, "Gateway order ID is required"],
      unique: true,
      trim: true
    },
    gatewayPaymentId: {
      type: String,
      default: null,
      trim: true
    },
    amount: {
      type: Number,
      required: [true, "Payment amount in minor units (paise) is required"],
      min: [0, "Amount cannot be negative"]
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true
    },
    status: {
      type: String,
      enum: [
        "CREATED",
        "AUTHORIZED",
        "CAPTURED",
        "FAILED",
        "CANCELLED",
        "EXPIRED",
        "REFUNDED",
        "PARTIALLY_REFUNDED"
      ],
      default: "CREATED",
      index: true
    },
    method: {
      type: String,
      default: null
    },
    verificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "FAILED"],
      default: "PENDING"
    },
    reconciliationStatus: {
      type: String,
      enum: ["NONE", "REFUND_REQUIRED", "SETTLED"],
      default: "NONE",
      index: true
    },
    committedRefundPaise: {
      type: Number,
      default: 0,
      min: [0, "Committed refund amount cannot be negative"]
    },
    failureReason: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index(
  { gatewayPaymentId: 1 },
  { unique: true, partialFilterExpression: { gatewayPaymentId: { $type: "string" } } }
);

const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

module.exports = Payment;
