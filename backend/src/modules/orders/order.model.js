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
      enum: ["COD"],
      default: "COD"
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING"
    },
    orderStatus: {
      type: String,
      enum: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
      default: "CONFIRMED"
    },
    statusHistory: {
      type: [orderStatusHistorySchema],
      default: []
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
orderSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

module.exports = Order;
