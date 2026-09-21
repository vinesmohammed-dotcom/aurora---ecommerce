const { Router } = require("express");
const CheckoutController = require("./checkout.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth } = require("../../middlewares/auth.middleware");
const {
  checkoutSummarySchema,
  checkoutCouponSchema
} = require("./checkout.validator");

const checkoutRouter = Router();
checkoutRouter.use(requireAuth);

checkoutRouter.post("/summary", validate(checkoutSummarySchema), CheckoutController.getSummary);
checkoutRouter.post("/coupon", validate(checkoutCouponSchema), CheckoutController.applyCoupon);

module.exports = checkoutRouter;
