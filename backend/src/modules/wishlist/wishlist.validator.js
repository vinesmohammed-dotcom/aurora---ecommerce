const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const addToWishlistSchema = z.object({
  productId: z
    .string({ required_error: "Product ID is required" })
    .regex(objectIdRegex, "Invalid Product ObjectId format")
});

const productIdParamSchema = z.object({
  productId: z
    .string({ required_error: "Product ID is required" })
    .regex(objectIdRegex, "Invalid Product ObjectId format")
});

module.exports = {
  addToWishlistSchema,
  productIdParamSchema
};
