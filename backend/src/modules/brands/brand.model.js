const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      minlength: [2, "Brand name must be at least 2 characters"],
      maxlength: [50, "Brand name cannot exceed 50 characters"],
      unique: true
    },
    slug: {
      type: String,
      required: [true, "Brand slug is required"],
      trim: true,
      lowercase: true,
      unique: true
    },
    logoUrl: {
      type: String,
      trim: true,
      default: ""
    },
    description: {
      type: String,
      trim: true,
      default: ""
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

brandSchema.index({ isActive: 1, name: 1 });

/**
 * Pre-save slug generator helper if slug not explicitly supplied
 */
brandSchema.pre("validate", function (next) {
  if (this.name && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  next();
});

const Brand = mongoose.models.Brand || mongoose.model("Brand", brandSchema);

module.exports = Brand;
