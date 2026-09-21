const mongoose = require("mongoose");

/**
 * Embedded Product Variant Schema
 */
const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, "Variant SKU is required"],
      trim: true,
      uppercase: true
    },
    attributes: {
      type: Map,
      of: String,
      default: {}
    },
    price: {
      type: Number,
      required: [true, "Variant selling price is required"],
      min: [0.01, "Price must be greater than zero"]
    },
    costPrice: {
      type: Number,
      required: [true, "Variant cost price is required"],
      min: [0, "Cost price cannot be negative"]
    },
    stock: {
      type: Number,
      required: [true, "Variant stock count is required"],
      min: [0, "Stock cannot be negative"],
      default: 0
    },
    images: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    _id: true,
    timestamps: false
  }
);

/**
 * Parent Product Schema with Embedded Variants
 */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must be at least 2 characters"],
      maxlength: [120, "Product name cannot exceed 120 characters"]
    },
    slug: {
      type: String,
      required: [true, "Product slug is required"],
      trim: true,
      lowercase: true,
      unique: true
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: [true, "Brand reference is required"]
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category reference is required"]
    },
    images: {
      type: [String],
      default: []
    },
    basePrice: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: false
    },
    variants: {
      type: [variantSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Indexes
productSchema.index({ "variants.sku": 1 }, { unique: true, sparse: true });
productSchema.index({ category: 1, isActive: 1, basePrice: 1 });
productSchema.index({ brand: 1, isActive: 1, basePrice: 1 });
productSchema.index({ name: "text", description: "text" });

/**
 * Pre-validate hook: auto-compute basePrice from lowest active variant price
 */
productSchema.pre("validate", function (next) {
  if (this.name && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Calculate basePrice (lowest active variant price)
  if (this.variants && this.variants.length > 0) {
    const activePrices = this.variants
      .filter((v) => v.isActive && v.price > 0)
      .map((v) => v.price);
    this.basePrice = activePrices.length > 0 ? Math.min(...activePrices) : (this.variants[0]?.price || 0);
  }

  next();
});

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

module.exports = Product;
