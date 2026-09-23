const RefundService = require("./refund.service");
const HTTP_CODES = require("../../constants/httpCodes");

class RefundController {
  /**
   * Request / Process a Refund against a Captured Payment
   */
  static async createRefund(req, res, next) {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const { orderId, amount, reason, idempotencyKey } = req.body;

      const result = await RefundService.createRefund({
        orderId,
        userId: req.user._id,
        amount,
        reason,
        idempotencyKey,
        isAdmin
      });

      return res.status(HTTP_CODES.CREATED).json({
        success: true,
        message: result.isDuplicate
          ? "Refund already initiated with this idempotency key."
          : "Refund processed successfully via payment gateway.",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get all refunds for an order
   */
  static async getRefundsByOrder(req, res, next) {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const refunds = await RefundService.getRefundsByOrderId(
        req.params.orderId,
        req.user._id,
        isAdmin
      );

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: { refunds }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: List all refunds across the platform
   */
  static async getAllRefundsAdmin(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const { status, search } = req.query;

      const result = await RefundService.getAllRefunds({ page, limit, status, search });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Settle a REFUND_REQUIRED cancelled order
   */
  static async settleCancelledOrderRefund(req, res, next) {
    try {
      const result = await RefundService.processRefundForCancelledOrder({
        orderId: req.params.orderId,
        adminId: req.user._id
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: "Cancelled order payment settled and refund processed.",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = RefundController;
