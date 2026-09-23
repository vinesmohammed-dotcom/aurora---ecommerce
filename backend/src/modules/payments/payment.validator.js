const { z } = require("zod");
const mongoose = require("mongoose");

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: "Invalid ID format"
});

const createPaymentSchema = z.object({
  addressId: objectIdSchema,
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(30, "Coupon code cannot exceed 30 characters")
    .optional()
    .nullable(),
  idempotencyKey: z
    .string()
    .trim()
    .max(100, "Idempotency key cannot exceed 100 characters")
    .optional()
    .nullable()
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1, "razorpay_order_id is required"),
  razorpay_payment_id: z.string().trim().min(1, "razorpay_payment_id is required"),
  razorpay_signature: z.string().trim().min(1, "razorpay_signature is required")
});

const retryPaymentSchema = z.object({
  orderId: objectIdSchema
});

const paymentIdParamSchema = z.object({
  id: objectIdSchema
});

const orderIdParamSchema = z.object({
  orderId: objectIdSchema
});

module.exports = {
  createPaymentSchema,
  verifyPaymentSchema,
  retryPaymentSchema,
  paymentIdParamSchema,
  orderIdParamSchema
};
