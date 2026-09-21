const CartService = require("./cart.service");
const asyncHandler = require("../../utils/asyncHandler");
const HTTP_CODES = require("../../constants/httpCodes");

/**
 * Controller: Get current user's cart with live catalog prices and stock status
 */
const getCart = asyncHandler(async (req, res) => {
  const cart = await CartService.getCart(req.user._id);
  res.status(HTTP_CODES.OK).json({
    success: true,
    data: {
      cart
    }
  });
});

/**
 * Controller: Add item or increment quantity in cart
 */
const addItem = asyncHandler(async (req, res) => {
  const cart = await CartService.addItem(req.user._id, req.body);
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: "Item added to cart.",
    data: {
      cart
    }
  });
});

/**
 * Controller: Update quantity of a specific variant in cart
 */
const updateItemQuantity = asyncHandler(async (req, res) => {
  const cart = await CartService.updateItemQuantity(
    req.user._id,
    req.params.variantId,
    req.body.quantity
  );
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: "Cart item updated.",
    data: {
      cart
    }
  });
});

/**
 * Controller: Remove specific variant from cart
 */
const removeItem = asyncHandler(async (req, res) => {
  const cart = await CartService.removeItem(req.user._id, req.params.variantId);
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: "Item removed from cart.",
    data: {
      cart
    }
  });
});

/**
 * Controller: Clear entire shopping cart
 */
const clearCart = asyncHandler(async (req, res) => {
  const cart = await CartService.clearCart(req.user._id);
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: "Cart cleared.",
    data: {
      cart
    }
  });
});

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart
};
