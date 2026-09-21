const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true
    },
    fullName: {
      type: String,
      required: [true, "Recipient full name is required"],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters"],
      maxlength: [100, "Full name cannot exceed 100 characters"]
    },
    phone: {
      type: String,
      required: [true, "Contact phone number is required"],
      trim: true,
      match: [/^[0-9+ -]{10,15}$/, "Please provide a valid contact phone number"]
    },
    addressLine1: {
      type: String,
      required: [true, "Street address line 1 is required"],
      trim: true,
      minlength: [3, "Address line 1 must be at least 3 characters"],
      maxlength: [200, "Address line 1 cannot exceed 200 characters"]
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [200, "Address line 2 cannot exceed 200 characters"],
      default: ""
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      minlength: [2, "City name must be at least 2 characters"],
      maxlength: [100, "City name cannot exceed 100 characters"]
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      minlength: [2, "State name must be at least 2 characters"],
      maxlength: [100, "State name cannot exceed 100 characters"]
    },
    postalCode: {
      type: String,
      required: [true, "Postal / ZIP code is required"],
      trim: true,
      minlength: [3, "Postal code must be at least 3 characters"],
      maxlength: [20, "Postal code cannot exceed 20 characters"]
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
      default: "India"
    },
    label: {
      type: String,
      enum: {
        values: ["HOME", "WORK", "OTHER"],
        message: "Label must be either HOME, WORK, or OTHER"
      },
      default: "HOME"
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying user default addresses efficiently
addressSchema.index({ userId: 1, isDefault: 1 });

const Address = mongoose.models.Address || mongoose.model("Address", addressSchema);

module.exports = Address;
