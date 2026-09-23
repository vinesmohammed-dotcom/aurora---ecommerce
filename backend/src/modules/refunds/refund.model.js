const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    refundNumber: {
      type: String,
      required: [true, "Refund number is required"],
      unique: true,
      trim: true,
      index: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order ID is required"],
      index: true
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: [true, "Payment ID is required"],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true
    },
    amount: {
      type: Number,
      required: [true, "Refund amount in minor units (paise) is required"],
      min: [1, "Refund amount must be at least 1 paisa"],
      validate: {
        validator: Number.isInteger,
        message: "Refund amount must be an integer minor unit (paise)"
      }
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true
    },
    reason: {
      type: String,
      required: [true, "Refund reason is required"],
      trim: true
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "PROCESSED", "FAILED"],
      default: "PENDING",
      index: true
    },
    refundType: {
      type: String,
      enum: ["FULL", "PARTIAL"],
      default: "FULL"
    },
    gateway: {
      type: String,
      enum: ["RAZORPAY"],
      default: "RAZORPAY",
      required: true
    },
    gatewayPaymentId: {
      type: String,
      required: [true, "Gateway payment ID is required"],
      trim: true
    },
    gatewayRefundId: {
      type: String,
      default: null,
      trim: true,
      index: true
    },
    idempotencyKey: {
      type: String,
      default: null,
      trim: true
    },
    failureReason: {
      type: String,
      default: null
    },
    processedAt: {
      type: Date,
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

refundSchema.index({ orderId: 1, createdAt: -1 });
refundSchema.index({ status: 1, createdAt: -1 });
refundSchema.index(
  { paymentId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

const Refund = mongoose.models.Refund || mongoose.model("Refund", refundSchema);

module.exports = Refund;
