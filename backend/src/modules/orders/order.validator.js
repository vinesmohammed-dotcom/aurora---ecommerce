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

const requestReturnSchema = z.object({
  reason: z
    .string({ required_error: "Return reason is required" })
    .trim()
    .min(3, "Return reason must be at least 3 characters")
    .max(500, "Return reason cannot exceed 500 characters")
});

const reviewReturnSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"], {
    required_error: "Decision must be 'APPROVED' or 'REJECTED'"
  }),
  rejectionReason: z
    .string()
    .trim()
    .max(500, "Rejection reason cannot exceed 500 characters")
    .optional()
    .default("")
});

const inspectReturnSchema = z.object({
  inspectionPassed: z.boolean({ required_error: "inspectionPassed must be a boolean" }),
  restock: z.boolean().optional().default(true),
  notes: z.string().trim().max(500).optional().default("")
});

module.exports = {
  createCodOrderSchema,
  cancelOrderSchema,
  updateOrderStatusSchema,
  orderIdParamSchema,
  requestReturnSchema,
  reviewReturnSchema,
  inspectReturnSchema
};
