const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const checkoutSummarySchema = z.object({
  addressId: z
    .string()
    .regex(objectIdRegex, "Invalid address ObjectId")
    .optional()
    .nullable(),
  couponCode: z
    .string()
    .trim()
    .min(3, "Coupon code must be at least 3 characters")
    .max(30)
    .transform((val) => val.toUpperCase())
    .optional()
    .nullable()
});

const checkoutCouponSchema = z.object({
  couponCode: z
    .string({ required_error: "Coupon code is required" })
    .trim()
    .min(3, "Coupon code must be at least 3 characters")
    .max(30)
    .transform((val) => val.toUpperCase())
});

module.exports = {
  checkoutSummarySchema,
  checkoutCouponSchema
};
