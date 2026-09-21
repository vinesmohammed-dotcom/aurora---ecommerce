const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createOfferSchema = z
  .object({
    name: z
      .string({ required_error: "Offer name is required" })
      .trim()
      .min(2, "Offer name must be at least 2 characters")
      .max(100, "Offer name cannot exceed 100 characters"),
    targetType: z.enum(["PRODUCT", "CATEGORY"], {
      required_error: "Target type must be either PRODUCT or CATEGORY"
    }),
    product: z
      .string()
      .regex(objectIdRegex, "Invalid product ObjectId")
      .optional()
      .nullable(),
    category: z
      .string()
      .regex(objectIdRegex, "Invalid category ObjectId")
      .optional()
      .nullable(),
    discountPercentage: z
      .number({ required_error: "Discount percentage is required" })
      .min(1, "Discount percentage must be at least 1%")
      .max(90, "Discount percentage cannot exceed 90%"),
    startDate: z
      .string()
      .datetime({ message: "Start date must be an ISO date string" })
      .optional()
      .or(z.date().optional()),
    endDate: z
      .string({ required_error: "End date is required" })
      .datetime({ message: "End date must be an ISO date string" })
      .or(z.date()),
    isActive: z.boolean().optional().default(true)
  })
  .refine(
    (data) => {
      if (data.targetType === "PRODUCT" && !data.product) {
        return false;
      }
      if (data.targetType === "CATEGORY" && !data.category) {
        return false;
      }
      return true;
    },
    {
      message: "Product ID is required for PRODUCT offer; Category ID is required for CATEGORY offer",
      path: ["targetType"]
    }
  );

const updateOfferSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  discountPercentage: z.number().min(1).max(90).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional()
});

const offerIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid offer ID")
});

module.exports = {
  createOfferSchema,
  updateOfferSchema,
  offerIdParamSchema
};
