const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const addToCartSchema = z.object({
  productId: z
    .string({ required_error: "Product ID is required" })
    .regex(objectIdRegex, "Invalid Product ObjectId format"),
  variantId: z
    .string({ required_error: "Variant ID is required" })
    .regex(objectIdRegex, "Invalid Variant ObjectId format"),
  quantity: z
    .number({ required_error: "Quantity is required" })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10, "Maximum per-item limit is 10")
    .default(1)
});

const updateCartItemSchema = z.object({
  quantity: z
    .number({ required_error: "Quantity is required" })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10, "Maximum per-item limit is 10")
});

const variantIdParamSchema = z.object({
  variantId: z
    .string({ required_error: "Variant ID is required" })
    .regex(objectIdRegex, "Invalid Variant ObjectId format")
});

module.exports = {
  addToCartSchema,
  updateCartItemSchema,
  variantIdParamSchema
};
