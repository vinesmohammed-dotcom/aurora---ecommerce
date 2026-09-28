const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Customer: Create Review Request Payload
 */
const createReviewSchema = z.object({
  rating: z
    .number({ required_error: "Rating is required" })
    .int("Rating must be an integer")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating cannot exceed 5"),
  title: z
    .string()
    .trim()
    .max(100, "Review title cannot exceed 100 characters")
    .optional()
    .default(""),
  comment: z
    .string({ required_error: "Review comment is required" })
    .trim()
    .min(2, "Review comment must be at least 2 characters")
    .max(2000, "Review comment cannot exceed 2000 characters"),
  orderId: z
    .string()
    .regex(objectIdRegex, "Invalid Order ID format")
    .optional(),
  orderItemId: z
    .string()
    .regex(objectIdRegex, "Invalid Order Item ID format")
    .optional()
});

/**
 * Customer: Update Review Request Payload
 */
const updateReviewSchema = z
  .object({
    rating: z
      .number()
      .int("Rating must be an integer")
      .min(1, "Rating must be at least 1")
      .max(5, "Rating cannot exceed 5")
      .optional(),
    title: z
      .string()
      .trim()
      .max(100, "Review title cannot exceed 100 characters")
      .optional(),
    comment: z
      .string()
      .trim()
      .min(2, "Review comment must be at least 2 characters")
      .max(2000, "Review comment cannot exceed 2000 characters")
      .optional()
  })
  .refine((data) => data.rating !== undefined || data.title !== undefined || data.comment !== undefined, {
    message: "At least one field (rating, title, or comment) must be provided for update"
  });

/**
 * Admin: Update Review Moderation Status
 */
const updateReviewStatusSchema = z.object({
  status: z.enum(["PUBLISHED", "HIDDEN"], {
    required_error: "Status must be either PUBLISHED or HIDDEN"
  })
});

/**
 * Public: Query Product Reviews
 */
const queryReviewsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(["newest", "oldest", "highest", "lowest"]).default("newest")
});

/**
 * Admin: Query All Reviews
 */
const adminQueryReviewsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["ALL", "PUBLISHED", "HIDDEN"]).default("ALL"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().trim().optional()
});

/**
 * Param validation schemas
 */
const productIdParamSchema = z.object({
  productId: z.string().regex(objectIdRegex, "Invalid Product ID format")
});

const reviewIdParamSchema = z.object({
  reviewId: z.string().regex(objectIdRegex, "Invalid Review ID format")
});

module.exports = {
  createReviewSchema,
  updateReviewSchema,
  updateReviewStatusSchema,
  queryReviewsSchema,
  adminQueryReviewsSchema,
  productIdParamSchema,
  reviewIdParamSchema
};
