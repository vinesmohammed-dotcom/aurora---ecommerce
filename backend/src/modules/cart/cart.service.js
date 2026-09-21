const Cart = require("./cart.model");
const Product = require("../products/product.model");
const Category = require("../categories/category.model");
const Brand = require("../brands/brand.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

const MAX_PER_ITEM_LIMIT = 10;

class CartService {
  /**
   * Fetch populated cart with real-time catalog prices, stock status, and stale warnings
   * Data Protection: wholesale costPrice is never exposed.
   */
  static async getCart(userId) {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }

    const populatedItems = [];
    let subtotal = 0;
    let totalItems = 0;
    let hasStaleItems = false;

    // Load active catalog info for each item in cart
    for (const item of cart.items) {
      const product = await Product.findById(item.productId)
        .select("-variants.costPrice")
        .populate("category", "name isActive")
        .populate("brand", "name isActive");

      if (!product || !product.isActive) {
        hasStaleItems = true;
        populatedItems.push({
          _id: item._id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          name: product ? product.name : "Unavailable Product",
          isAvailable: false,
          staleReason: "Product is no longer active or available",
          unitPrice: 0,
          itemTotal: 0,
          stock: 0
        });
        continue;
      }

      const variant = product.variants.id(item.variantId);
      if (!variant || !variant.isActive) {
        hasStaleItems = true;
        populatedItems.push({
          _id: item._id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          name: product.name,
          isAvailable: false,
          staleReason: "Selected product variant is no longer available",
          unitPrice: 0,
          itemTotal: 0,
          stock: 0
        });
        continue;
      }

      // Live stock comparison for stale stock detection
      const isStaleStock = item.quantity > variant.stock;
      if (isStaleStock || variant.stock === 0) {
        hasStaleItems = true;
      }

      const unitPrice = variant.price;
      const itemTotal = unitPrice * item.quantity;
      const isAvailable = variant.stock > 0;

      if (isAvailable && !isStaleStock) {
        subtotal += itemTotal;
        totalItems += item.quantity;
      }

      populatedItems.push({
        _id: item._id,
        productId: product._id,
        variantId: variant._id,
        sku: variant.sku,
        name: product.name,
        slug: product.slug,
        variantTitle: variant.attributes instanceof Map ? Object.fromEntries(variant.attributes) : variant.attributes,
        image: (variant.images && variant.images[0]) || (product.images && product.images[0]) || "",
        unitPrice,
        quantity: item.quantity,
        itemTotal,
        availableStock: variant.stock,
        isAvailable,
        staleStock: isStaleStock,
        warning: isStaleStock
          ? variant.stock === 0
            ? "Out of stock"
            : `Only ${variant.stock} items currently available in warehouse`
          : null
      });
    }

    return {
      _id: cart._id,
      userId: cart.userId,
      items: populatedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      totalItems,
      hasStaleItems,
      updatedAt: cart.updatedAt
    };
  }

  /**
   * Add item to cart or increment quantity
   * Enforces product active, category/brand active, variant existence, stock limits, and max quantity
   */
  static async addItem(userId, { productId, variantId, quantity = 1 }) {
    // 1. Verify Product
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new AppError("Product is inactive or unavailable.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    // 2. Verify Category and Brand
    const [category, brand] = await Promise.all([
      Category.findById(product.category),
      Brand.findById(product.brand)
    ]);
    if (!category || !category.isActive) {
      throw new AppError("Product category is inactive.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!brand || !brand.isActive) {
      throw new AppError("Product brand is inactive.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    // 3. Verify Variant belongs to Product (Mismatched reference defense)
    const variant = product.variants.id(variantId);
    if (!variant) {
      throw new AppError(
        "Variant does not exist for this product.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    if (!variant.isActive) {
      throw new AppError("Selected variant is inactive.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    // 4. Find or create user cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // 5. Check if item already exists in cart
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId.toString() && item.variantId.toString() === variantId.toString()
    );

    const currentCartQty = existingItem ? existingItem.quantity : 0;
    const requestedTotalQty = currentCartQty + quantity;

    if (requestedTotalQty > MAX_PER_ITEM_LIMIT) {
      throw new AppError(
        `Maximum limit of ${MAX_PER_ITEM_LIMIT} units per item reached in cart.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (requestedTotalQty > variant.stock) {
      throw new AppError(
        `Insufficient stock. Available: ${variant.stock}, requested in cart: ${requestedTotalQty}.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (existingItem) {
      existingItem.quantity = requestedTotalQty;
    } else {
      cart.items.push({ productId, variantId, quantity });
    }

    await cart.save();
    return this.getCart(userId);
  }

  /**
   * Update item quantity directly
   */
  static async updateItemQuantity(userId, variantId, quantity) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new AppError("Cart not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const item = cart.items.find((i) => i.variantId.toString() === variantId.toString());
    if (!item) {
      throw new AppError("Item not found in your cart.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (quantity > MAX_PER_ITEM_LIMIT) {
      throw new AppError(
        `Maximum limit of ${MAX_PER_ITEM_LIMIT} units per item reached.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Verify stock
    const product = await Product.findById(item.productId);
    const variant = product?.variants.id(variantId);
    if (!product || !product.isActive || !variant || !variant.isActive) {
      throw new AppError("Product or variant is no longer available.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    if (quantity > variant.stock) {
      throw new AppError(
        `Requested quantity (${quantity}) exceeds available stock (${variant.stock}).`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    item.quantity = quantity;
    await cart.save();

    return this.getCart(userId);
  }

  /**
   * Remove item from cart
   */
  static async removeItem(userId, variantId) {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new AppError("Cart not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    cart.items = cart.items.filter((item) => item.variantId.toString() !== variantId.toString());
    await cart.save();

    return this.getCart(userId);
  }

  /**
   * Clear all items in user's cart
   */
  static async clearCart(userId) {
    let cart = await Cart.findOne({ userId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    return this.getCart(userId);
  }
}

module.exports = CartService;
