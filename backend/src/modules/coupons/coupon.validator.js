const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createCouponSchema = z
  .object({
    code: z
      .string({ required_error: "Coupon code is required" })
      .trim()
      .min(3, "Coupon code must be at least 3 characters")
      .max(30, "Coupon code cannot exceed 30 characters")
      .transform((val) => val.toUpperCase()),
    description: z.string().trim().max(255).optional().default(""),
    discountType: z.enum(["PERCENTAGE", "FLAT"], {
      required_error: "Discount type must be either PERCENTAGE or FLAT"
    }),
    discountValue: z
      .number({ required_error: "Discount value is required" })
      .min(1, "Discount value must be at least 1"),
    minOrderValue: z.number().min(0, "Minimum order value cannot be negative").optional().default(0),
    maxDiscount: z.number().min(1, "Max discount cap must be at least 1").optional().nullable(),
    startDate: z
      .string()
      .datetime({ message: "Start date must be an ISO date string" })
      .optional()
      .or(z.date().optional()),
    expiryDate: z
      .string({ required_error: "Expiry date is required" })
      .datetime({ message: "Expiry date must be an ISO date string" })
      .or(z.date()),
    usageLimit: z.number().min(1).optional().nullable(),
    perUserLimit: z.number().min(1).optional().default(1),
    isActive: z.boolean().optional().default(true)
  })
  .refine(
    (data) => {
      if (data.discountType === "PERCENTAGE" && data.discountValue > 90) {
        return false;
      }
      return true;
    },
    {
      message: "Percentage discount cannot exceed 90%",
      path: ["discountValue"]
    }
  );

const updateCouponSchema = z.object({
  description: z.string().trim().max(255).optional(),
  discountType: z.enum(["PERCENTAGE", "FLAT"]).optional(),
  discountValue: z.number().min(1).optional(),
  minOrderValue: z.number().min(0).optional(),
  maxDiscount: z.number().min(1).optional().nullable(),
  startDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  usageLimit: z.number().min(1).optional().nullable(),
  perUserLimit: z.number().min(1).optional(),
  isActive: z.boolean().optional()
});

const couponIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid coupon ID")
});

const applyCouponSchema = z.object({
  code: z
    .string({ required_error: "Coupon code is required" })
    .trim()
    .min(3, "Coupon code must be at least 3 characters")
    .max(30)
    .transform((val) => val.toUpperCase())
});

module.exports = {
  createCouponSchema,
  updateCouponSchema,
  couponIdParamSchema,
  applyCouponSchema
};
