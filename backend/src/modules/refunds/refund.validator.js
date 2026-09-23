const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createRefundSchema = z.object({
  orderId: z
    .string({ required_error: "Order ID is required" })
    .regex(objectIdRegex, "Invalid order ID"),
  amount: z
    .number()
    .int("Refund amount must be an integer minor unit (paise)")
    .positive("Refund amount must be a positive integer in paise")
    .optional(),
  reason: z
    .string({ required_error: "Refund reason is required" })
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(255, "Reason cannot exceed 255 characters"),
  idempotencyKey: z
    .string()
    .trim()
    .min(5)
    .max(100)
    .optional()
    .nullable()
});

const orderIdParamSchema = z.object({
  orderId: z.string().regex(objectIdRegex, "Invalid order ID")
});

const refundPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["PENDING", "PROCESSING", "PROCESSED", "FAILED"]).optional(),
  search: z.string().trim().max(100).optional()
});

module.exports = {
  createRefundSchema,
  orderIdParamSchema,
  refundPaginationSchema
};
