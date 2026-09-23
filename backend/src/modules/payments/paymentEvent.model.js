const mongoose = require("mongoose");

const paymentEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, "Webhook event ID is required"],
      unique: true,
      trim: true
    },
    eventType: {
      type: String,
      required: [true, "Webhook event type is required"],
      trim: true
    },
    gatewayOrderId: {
      type: String,
      default: null,
      trim: true,
      index: true
    },
    gatewayPaymentId: {
      type: String,
      default: null,
      trim: true
    },
    receivedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: {
      type: Date,
      default: Date.now
    },
    processingStatus: {
      type: String,
      enum: ["PROCESSED", "DUPLICATE", "IGNORED", "FAILED"],
      default: "PROCESSED"
    }
  },
  {
    timestamps: false
  }
);

const PaymentEvent =
  mongoose.models.PaymentEvent || mongoose.model("PaymentEvent", paymentEventSchema);

module.exports = PaymentEvent;
