const { Router } = require("express");
const RefundController = require("./refund.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const {
  createRefundSchema,
  orderIdParamSchema,
  refundPaginationSchema
} = require("./refund.validator");

// Customer / Order Refund Router: /api/v1/refunds
const refundRouter = Router();
refundRouter.use(requireAuth);

// Only ADMIN can initiate gateway refunds (Requirement 16)
refundRouter.post("/", requireRole("ADMIN"), validate(createRefundSchema), RefundController.createRefund);
refundRouter.get(
  "/order/:orderId",
  validate(orderIdParamSchema, "params"),
  RefundController.getRefundsByOrder
);

// Admin Refund Router: /api/v1/admin/refunds
const adminRefundRouter = Router();
adminRefundRouter.use(requireAuth);
adminRefundRouter.use(requireRole("ADMIN"));

adminRefundRouter.get(
  "/",
  validate(refundPaginationSchema, "query"),
  RefundController.getAllRefundsAdmin
);
adminRefundRouter.post(
  "/",
  validate(createRefundSchema),
  RefundController.createRefund
);
adminRefundRouter.post(
  "/order/:orderId/settle",
  validate(orderIdParamSchema, "params"),
  RefundController.settleCancelledOrderRefund
);

module.exports = {
  refundRouter,
  adminRefundRouter
};
