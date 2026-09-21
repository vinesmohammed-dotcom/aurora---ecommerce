const mongoose = require("mongoose");

const couponUserUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: false }
);

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, "Coupon code must be at least 3 characters"],
      maxlength: [30, "Coupon code cannot exceed 30 characters"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [255, "Description cannot exceed 255 characters"],
      default: ""
    },
    discountType: {
      type: String,
      required: [true, "Discount type is required"],
      enum: {
        values: ["PERCENTAGE", "FLAT"],
        message: "Discount type must be either PERCENTAGE or FLAT"
      }
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [1, "Discount value must be at least 1"]
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Minimum order value cannot be negative"]
    },
    maxDiscount: {
      type: Number,
      default: null
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"]
    },
    usageLimit: {
      type: Number,
      default: null,
      min: [1, "Usage limit must be at least 1 if set"]
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: [1, "Per-user limit must be at least 1"]
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Used count cannot be negative"]
    },
    userUsage: {
      type: [couponUserUsageSchema],
      default: []
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

couponSchema.index({ isActive: 1, startDate: 1, expiryDate: 1 });

const Coupon = mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
