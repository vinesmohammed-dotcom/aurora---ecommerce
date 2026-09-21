const express = require("express");
const cartController = require("./cart.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth } = require("../../middlewares/auth.middleware");
const {
  addToCartSchema,
  updateCartItemSchema,
  variantIdParamSchema
} = require("./cart.validator");

const router = express.Router();

// All cart operations require an authenticated user session
router.use(requireAuth);

router.get("/", cartController.getCart);
router.post("/items", validate(addToCartSchema, "body"), cartController.addItem);
router.patch(
  "/items/:variantId",
  validate(variantIdParamSchema, "params"),
  validate(updateCartItemSchema, "body"),
  cartController.updateItemQuantity
);
router.delete("/items/:variantId", validate(variantIdParamSchema, "params"), cartController.removeItem);
router.delete("/", cartController.clearCart);

module.exports = router;
