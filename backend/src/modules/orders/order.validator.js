const { z } = require("zod");

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createCodOrderSchema = z.object({
  addressId: z
    .string({ required_error: "Delivery address ID is required" })
    .regex(objectIdRegex, "Invalid address ID"),
  couponCode: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .transform((val) => val.toUpperCase())
    .optional()
    .nullable(),
  idempotencyKey: z
    .string()
    .trim()
    .min(5, "Idempotency key must be at least 5 characters")
    .max(100)
    .optional()
    .nullable()
});

const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(255, "Cancellation reason cannot exceed 255 characters")
    .optional()
    .default("Customer cancelled order before dispatch")
});

const updateOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"], {
    required_error: "Order status is required"
  }),
  note: z.string().trim().max(255).optional().default("")
});

const orderIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, "Invalid order ID")
});

module.exports = {
  createCodOrderSchema,
  cancelOrderSchema,
  updateOrderStatusSchema,
  orderIdParamSchema
};
