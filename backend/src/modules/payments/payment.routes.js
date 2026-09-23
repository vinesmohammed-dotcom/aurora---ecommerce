const { Router } = require("express");
const PaymentController = require("./payment.controller");
const { requireAuth } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const { paymentLimiter, webhookLimiter } = require("../../middlewares/rateLimiter.middleware");
const {
  createPaymentSchema,
  verifyPaymentSchema,
  retryPaymentSchema,
  paymentIdParamSchema,
  orderIdParamSchema
} = require("./payment.validator");

const router = Router();

/**
 * Public Webhook Endpoint
 * Must NOT require session auth. Uses raw body HMAC signature verification.
 */
router.post("/webhook", webhookLimiter, PaymentController.handleWebhook);

/**
 * Protected Customer Payment Endpoints
 */
router.use(requireAuth);

router.post("/create", paymentLimiter, validate(createPaymentSchema), PaymentController.createPayment);
router.post("/verify", paymentLimiter, validate(verifyPaymentSchema), PaymentController.verifyPayment);
router.post("/retry", paymentLimiter, validate(retryPaymentSchema), PaymentController.retryPayment);
router.get("/order/:orderId", validate(orderIdParamSchema, "params"), PaymentController.getPaymentByOrderId);
router.get("/:id", validate(paymentIdParamSchema, "params"), PaymentController.getPaymentById);

module.exports = router;
