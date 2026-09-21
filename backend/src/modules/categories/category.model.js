const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      minlength: [2, "Category name must be at least 2 characters"],
      maxlength: [50, "Category name cannot exceed 50 characters"],
      unique: true
    },
    slug: {
      type: String,
      required: [true, "Category slug is required"],
      trim: true,
      lowercase: true,
      unique: true
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

// Index for active status filtering and sorting
categorySchema.index({ isActive: 1, name: 1 });

/**
 * Pre-save slug generator helper if slug not explicitly supplied
 */
categorySchema.pre("validate", function (next) {
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

const Category = mongoose.models.Category || mongoose.model("Category", categorySchema);

module.exports = Category;
