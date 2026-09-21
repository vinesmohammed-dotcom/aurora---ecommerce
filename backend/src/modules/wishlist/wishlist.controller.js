const WishlistService = require("./wishlist.service");
const asyncHandler = require("../../utils/asyncHandler");
const HTTP_CODES = require("../../constants/httpCodes");

/**
 * Controller: Get current user's wishlist
 */
const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await WishlistService.getWishlist(req.user._id);
  res.status(HTTP_CODES.OK).json({
    success: true,
    data: {
      wishlist
    }
  });
});

/**
 * Controller: Add product to wishlist
 */
const addItem = asyncHandler(async (req, res) => {
  const wishlist = await WishlistService.addItem(req.user._id, req.body.productId);
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: "Product added to wishlist.",
    data: {
      wishlist
    }
  });
});

/**
 * Controller: Remove product from wishlist
 */
const removeItem = asyncHandler(async (req, res) => {
  const wishlist = await WishlistService.removeItem(req.user._id, req.params.productId);
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: "Product removed from wishlist.",
    data: {
      wishlist
    }
  });
});

/**
 * Controller: Toggle product in wishlist
 */
const toggleItem = asyncHandler(async (req, res) => {
  const wishlist = await WishlistService.toggleItem(req.user._id, req.body.productId);
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: "Wishlist updated.",
    data: {
      wishlist
    }
  });
});

module.exports = {
  getWishlist,
  addItem,
  removeItem,
  toggleItem
};
