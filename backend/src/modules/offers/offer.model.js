const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Offer name is required"],
      trim: true,
      minlength: [2, "Offer name must be at least 2 characters"],
      maxlength: [100, "Offer name cannot exceed 100 characters"]
    },
    targetType: {
      type: String,
      required: [true, "Target type is required"],
      enum: {
        values: ["PRODUCT", "CATEGORY"],
        message: "Target type must be either PRODUCT or CATEGORY"
      }
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    discountPercentage: {
      type: Number,
      required: [true, "Discount percentage is required"],
      min: [1, "Discount percentage must be at least 1%"],
      max: [90, "Discount percentage cannot exceed 90%"]
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"]
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

offerSchema.index({ targetType: 1, product: 1, isActive: 1 });
offerSchema.index({ targetType: 1, category: 1, isActive: 1 });
offerSchema.index({ startDate: 1, endDate: 1, isActive: 1 });

const Offer = mongoose.models.Offer || mongoose.model("Offer", offerSchema);

module.exports = Offer;
