const mongoose = require("mongoose");

const orderItemSnapshotSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    sku: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      required: true
    },
    image: {
      type: String,
      default: ""
    },
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    unitPrice: {
      type: Number,
      required: true
    },
    offer: {
      type: {
        name: String,
        targetType: String,
        discountPercentage: Number
      },
      default: null
    },
    discountedUnitPrice: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    itemTotal: {
      type: Number,
      required: true
    }
  },
  { _id: true }
);

const orderAddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  { _id: false }
);

const orderStatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    shippingAddress: {
      type: orderAddressSnapshotSchema,
      required: true
    },
    items: {
      type: [orderItemSnapshotSchema],
      required: true,
      validate: {
        validator: (items) => items && items.length > 0,
        message: "An order must contain at least one item."
      }
    },
    priceSummary: {
      grossSubtotal: { type: Number, required: true },
      offerDiscountTotal: { type: Number, required: true },
      netSubtotal: { type: Number, required: true },
      couponDiscount: { type: Number, required: true },
      shippingFee: { type: Number, required: true },
      grandTotal: { type: Number, required: true }
    },
    appliedCoupon: {
      type: {
        code: String,
        discountType: String,
        discountValue: Number,
        discountAmount: Number
      },
      default: null
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE_RAZORPAY"],
      default: "COD"
    },
    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "COMPLETED",
        "FAILED",
        "EXPIRED",
        "REFUND_REQUIRED",
        "REFUND_PENDING",
        "REFUNDED",
        "PARTIALLY_REFUNDED"
      ],
      default: "PENDING"
    },
    paymentExpiresAt: {
      type: Date,
      default: null,
      index: true
    },
    orderStatus: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "RETURN_REQUESTED",
        "RETURN_APPROVED",
        "RETURN_REJECTED",
        "RETURN_RECEIVED",
        "RETURN_INSPECTED",
        "RETURNED"
      ],
      default: "CONFIRMED"
    },
    statusHistory: {
      type: [orderStatusHistorySchema],
      default: []
    },
    returnRequest: {
      status: {
        type: String,
        enum: [
          "NONE",
          "REQUESTED",
          "APPROVED",
          "REJECTED",
          "RECEIVED",
          "INSPECTED_PASSED",
          "INSPECTED_FAILED"
        ],
        default: "NONE"
      },
      reason: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      rejectionReason: { type: String, default: "" },
      receivedAt: { type: Date, default: null },
      receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      inspectionDetails: {
        inspectedAt: { type: Date, default: null },
        inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        passed: { type: Boolean, default: null },
        restocked: { type: Boolean, default: null },
        notes: { type: String, default: "" }
      },
      inventoryRestored: { type: Boolean, default: false }
    },
    idempotencyKey: {
      type: String,
      default: null
    },
    cancellationReason: {
      type: String,
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ createdAt: -1, orderStatus: 1 });
orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

module.exports = Order;
