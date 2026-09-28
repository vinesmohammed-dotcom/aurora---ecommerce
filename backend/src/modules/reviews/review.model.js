const mongoose = require("mongoose");

/**
 * Review Schema
 * Represents customer product ratings and reviews with server-authoritative Verified Purchase gating.
 */
const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order reference is required"],
      index: true
    },
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Order item reference is required"],
      unique: true // Strict business rule: prevents duplicate reviews for the same purchased order item
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5"
      }
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "Review title cannot exceed 100 characters"],
      default: ""
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      trim: true,
      minlength: [2, "Review comment must be at least 2 characters"],
      maxlength: [2000, "Review comment cannot exceed 2000 characters"]
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true // Determined strictly server-side
    },
    status: {
      type: String,
      enum: {
        values: ["PUBLISHED", "HIDDEN"],
        message: "Status must be either PUBLISHED or HIDDEN"
      },
      default: "PUBLISHED",
      index: true
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: [0, "Helpful count cannot be negative"]
    },
    helpfulVoters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  {
    timestamps: true
  }
);

// Compound indexes for high-throughput queries
reviewSchema.index({ productId: 1, userId: 1 });
reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, rating: 1 });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

module.exports = Review;
