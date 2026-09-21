const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"]
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Embedded variant ID is required"]
    },
    quantity: {
      type: Number,
      required: [true, "Item quantity is required"],
      min: [1, "Quantity must be at least 1"],
      max: [10, "Maximum allowable quantity per item is 10"],
      default: 1
    }
  },
  {
    _id: true,
    timestamps: true
  }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true
    },
    items: {
      type: [cartItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const Cart = mongoose.models.Cart || mongoose.model("Cart", cartSchema);

module.exports = Cart;
