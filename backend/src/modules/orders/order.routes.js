const { Router } = require("express");
const OrderController = require("./order.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const {
  createCodOrderSchema,
  cancelOrderSchema,
  updateOrderStatusSchema,
  orderIdParamSchema,
  requestReturnSchema,
  reviewReturnSchema,
  inspectReturnSchema
} = require("./order.validator");

// Customer routes: /api/v1/orders
const customerOrderRouter = Router();
customerOrderRouter.use(requireAuth);

customerOrderRouter.post(
  "/checkout/cod",
  validate(createCodOrderSchema),
  OrderController.createCodOrder
);
customerOrderRouter.get("/", OrderController.getMyOrders);
customerOrderRouter.get("/:id", validate(orderIdParamSchema, "params"), OrderController.getOrderById);
customerOrderRouter.post(
  "/:id/cancel",
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema),
  OrderController.cancelOrder
);
customerOrderRouter.post(
  "/:id/return",
  validate(orderIdParamSchema, "params"),
  validate(requestReturnSchema),
  OrderController.requestReturn
);

// Admin routes: /api/v1/admin/orders
const adminOrderRouter = Router();
adminOrderRouter.use(requireAuth, requireRole("ADMIN"));

adminOrderRouter.get("/", OrderController.getAllOrdersAdmin);
adminOrderRouter.get("/:id", validate(orderIdParamSchema, "params"), OrderController.getOrderById);
adminOrderRouter.patch(
  "/:id/status",
  validate(orderIdParamSchema, "params"),
  validate(updateOrderStatusSchema),
  OrderController.updateOrderStatusAdmin
);
adminOrderRouter.post(
  "/:id/cancel",
  validate(orderIdParamSchema, "params"),
  validate(cancelOrderSchema),
  OrderController.cancelOrder
);
adminOrderRouter.post(
  "/:id/return/review",
  validate(orderIdParamSchema, "params"),
  validate(reviewReturnSchema),
  OrderController.reviewReturn
);
adminOrderRouter.post(
  "/:id/return/receive",
  validate(orderIdParamSchema, "params"),
  OrderController.markReturnReceived
);
adminOrderRouter.post(
  "/:id/return/inspect",
  validate(orderIdParamSchema, "params"),
  validate(inspectReturnSchema),
  OrderController.inspectReturn
);

module.exports = {
  customerOrderRouter,
  adminOrderRouter
};
