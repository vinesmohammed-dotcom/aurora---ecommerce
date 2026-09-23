const { z } = require("zod");

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name cannot exceed 50 characters").optional(),
  phone: z.string().trim().regex(/^\d{10}$/, "Phone number must be exactly 10 digits").optional()
});

const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isBlocked: z.enum(["true", "false"]).optional(),
  isVerified: z.enum(["true", "false"]).optional()
});

const blockUserSchema = z.object({
  isBlocked: z.boolean(),
  reason: z.string().trim().max(200).optional()
});

module.exports = {
  updateProfileSchema,
  adminUserQuerySchema,
  blockUserSchema
};

