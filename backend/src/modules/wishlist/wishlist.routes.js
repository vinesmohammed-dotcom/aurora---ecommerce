const express = require("express");
const wishlistController = require("./wishlist.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth } = require("../../middlewares/auth.middleware");
const {
  addToWishlistSchema,
  productIdParamSchema
} = require("./wishlist.validator");

const router = express.Router();

// All wishlist operations require an authenticated user session
router.use(requireAuth);

router.get("/", wishlistController.getWishlist);
router.post("/items", validate(addToWishlistSchema, "body"), wishlistController.addItem);
router.delete("/items/:productId", validate(productIdParamSchema, "params"), wishlistController.removeItem);
router.post("/toggle", validate(addToWishlistSchema, "body"), wishlistController.toggleItem);

module.exports = router;
