const { Router } = require("express");
const CouponController = require("./coupon.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const {
  createCouponSchema,
  updateCouponSchema,
  couponIdParamSchema,
  applyCouponSchema
} = require("./coupon.validator");

const publicCouponRouter = Router();
publicCouponRouter.post(
  "/validate",
  requireAuth,
  validate(applyCouponSchema),
  CouponController.validateCoupon
);

const adminCouponRouter = Router();
adminCouponRouter.use(requireAuth, requireRole("ADMIN"));

adminCouponRouter.get("/", CouponController.getCoupons);
adminCouponRouter.post("/", validate(createCouponSchema), CouponController.createCoupon);
adminCouponRouter.get("/:id", validate(couponIdParamSchema, "params"), CouponController.getCouponById);
adminCouponRouter.put(
  "/:id",
  validate(couponIdParamSchema, "params"),
  validate(updateCouponSchema),
  CouponController.updateCoupon
);
adminCouponRouter.delete("/:id", validate(couponIdParamSchema, "params"), CouponController.deleteCoupon);

module.exports = {
  publicCouponRouter,
  adminCouponRouter
};
