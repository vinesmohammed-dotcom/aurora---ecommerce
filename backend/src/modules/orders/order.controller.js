const OrderService = require("./order.service");
const HTTP_CODES = require("../../constants/httpCodes");

class OrderController {
  /**
   * Customer: Place order using Cash on Delivery (COD)
   */
  static async createCodOrder(req, res, next) {
    try {
      const { addressId, couponCode } = req.body;
      const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey;
      const order = await OrderService.createCodOrder({
        userId: req.user._id,
        addressId,
        couponCode,
        idempotencyKey
      });

      return res.status(HTTP_CODES.CREATED).json({
        success: true,
        message: "Order placed successfully via Cash on Delivery.",
        data: { order }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer: List user's past orders
   */
  static async getMyOrders(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const result = await OrderService.getMyOrders(req.user._id, { page, limit });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer: Get order details with anti-IDOR protection
   */
  static async getOrderById(req, res, next) {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const order = await OrderService.getOrderById(req.params.id, req.user._id, isAdmin);

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: { order }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer: Cancel order
   */
  static async cancelOrder(req, res, next) {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const { reason } = req.body || {};
      const order = await OrderService.cancelOrder({
        orderId: req.params.id,
        userId: req.user._id,
        reason,
        isAdmin
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: "Order cancelled successfully.",
        data: { order }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: List all orders with filters
   */
  static async getAllOrdersAdmin(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const { status, search } = req.query;

      const result = await OrderService.getAllOrders({ page, limit, status, search });
      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Update order status along state machine
   */
  static async updateOrderStatusAdmin(req, res, next) {
    try {
      const { status, note } = req.body;
      const order = await OrderService.updateOrderStatus({
        orderId: req.params.id,
        newStatus: status,
        note
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: `Order status updated to ${status}.`,
        data: { order }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer: Request Return for a Delivered Order within 7 Days
   */
  static async requestReturn(req, res, next) {
    try {
      const { reason } = req.body;
      const order = await OrderService.requestReturn({
        orderId: req.params.id,
        userId: req.user._id,
        reason
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: "Return request submitted successfully.",
        data: { order }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Review and Approve or Reject Return Request
   */
  static async reviewReturn(req, res, next) {
    try {
      const { decision, rejectionReason } = req.body;
      const order = await OrderService.reviewReturnRequest({
        orderId: req.params.id,
        adminId: req.user._id,
        decision,
        rejectionReason
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: `Return request ${decision.toLowerCase()} successfully.`,
        data: { order }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Mark Returned Item as Received at Warehouse
   */
  static async markReturnReceived(req, res, next) {
    try {
      const order = await OrderService.markReturnReceived({
        orderId: req.params.id,
        adminId: req.user._id
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: "Returned item marked as received at warehouse.",
        data: { order }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Inspect Returned Item & Decide Restocking
   */
  static async inspectReturn(req, res, next) {
    try {
      const { inspectionPassed, restock, notes } = req.body;
      const order = await OrderService.inspectReturnItem({
        orderId: req.params.id,
        adminId: req.user._id,
        inspectionPassed,
        restock,
        notes
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: "Return inspection completed successfully.",
        data: { order }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = OrderController;
