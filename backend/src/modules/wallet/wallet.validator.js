const { z } = require("zod");

const adminAdjustWalletSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Amount must be a valid number" })
    .int("Amount must be an integer minor unit (paise)")
    .positive("Amount must be greater than zero"),
  reason: z
    .string({ required_error: "Reason is required for administrative balance adjustment" })
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(500, "Reason cannot exceed 500 characters"),
  idempotencyKey: z.string().trim().optional()
});

const walletPaginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

module.exports = {
  adminAdjustWalletSchema,
  walletPaginationSchema
};
