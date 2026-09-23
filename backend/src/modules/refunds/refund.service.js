const mongoose = require("mongoose");
const Refund = require("./refund.model");
const Payment = require("../payments/payment.model");
const Order = require("../orders/order.model");
const { runInTransaction } = require("../../utils/transaction");
const AuditLogger = require("../../utils/auditLogger");
const env = require("../../config/env");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class RefundService {
  /**
   * Helper to generate unique human-readable refund number
   */
  static generateRefundNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `REF-${timestamp}-${randomSuffix}`;
  }

  /**
   * Helper to generate mock Razorpay refund ID
   */
  static generateGatewayRefundId() {
    return `rfnd_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Helper to invoke Gateway Refund API (isolated from database transactions)
   */
  static async invokeGatewayRefund({ gatewayPaymentId, amountInPaise }) {
    if (process.env.FORCE_REFUND_GATEWAY_FAILURE === "true") {
      throw new Error("Razorpay gateway timeout 504 Gateway Timeout");
    }
    return this.generateGatewayRefundId();
  }

  /**
   * Initiate Gateway Refund against a Captured Payment (ADR-29: Strict Transaction Isolation)
   *
   * 1. Validate order and anti-IDOR ownership
   * 2. Reject COD orders (COD has no online payment gateway to refund)
   * 3. Locate captured payment (reject uncaptured/pending/failed payments)
   * 4. Enforce refund amount <= captured amount - previously refunded amount
   * 5. Check idempotency (paymentId + idempotencyKey)
   * 6. Step A: Create PENDING refund in DB
   * 7. Step B: Invoke Gateway API strictly OUTSIDE DB transaction
   * 8. Step C: Update Refund to PROCESSED, update Payment and Order states atomically
   * 9. On gateway failure: mark Refund FAILED without corrupting Payment/Order
   */
  /**
   * Initiate Gateway Refund against a Captured Payment (ADR-29: Strict Transaction Isolation & Capacity Reservation)
   *
   * 1. Validate order and anti-IDOR ownership
   * 2. Reject COD orders (COD has no online payment gateway to refund)
   * 3. Locate captured payment (reject uncaptured/pending/failed payments)
   * 4. Step A: Atomically check capacity and reserve PENDING refund in DB
   * 5. Step B: Invoke Gateway API strictly OUTSIDE DB transaction (ADR-29)
   * 6. Step C: Update Refund to PROCESSED, update Payment and Order states atomically
   * 7. On gateway failure: mark Refund FAILED, releasing the reservation for legitimate retry
   */
  static async createRefund({
    orderId,
    userId,
    amount,
    reason,
    idempotencyKey = null,
    isAdmin = false,
    isFull = false
  }) {
    // 1. Locate Order and verify ownership
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (!isAdmin && order.userId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized access to order.", HTTP_CODES.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }

    // 2. Reject COD orders
    if (order.paymentMethod === "COD") {
      throw new AppError(
        "Cash on Delivery (COD) orders cannot be refunded through the online payment gateway.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 3. Locate Payment record
    const payment = await Payment.findOne({
      orderId: order._id,
      gateway: "RAZORPAY"
    }).sort({ createdAt: -1 });

    if (!payment) {
      throw new AppError(
        "No online payment record found for this order.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // 4. Idempotency Check (Check before status validation to return cached result for already-refunded payment)
    if (idempotencyKey) {
      const existingRefund = await Refund.findOne({
        paymentId: payment._id,
        idempotencyKey
      });
      if (existingRefund) {
        return { refund: existingRefund, payment, order, isDuplicate: true };
      }
    }

    // Reject uncaptured or pending payments
    if (!["CAPTURED", "PARTIALLY_REFUNDED"].includes(payment.status)) {
      throw new AppError(
        `Cannot refund payment with status '${payment.status}'. Only captured online payments can be refunded.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (!payment.gatewayPaymentId) {
      throw new AppError(
        "Payment is missing gateway payment transaction ID.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 5. Step A: Atomic Database Capacity Check & Reservation
    const existingRefunds = await Refund.find({
      paymentId: payment._id,
      status: { $in: ["PROCESSED", "PROCESSING", "PENDING"] }
    });

    const totalCommittedOrPendingPaise = Math.max(
      payment.committedRefundPaise || 0,
      existingRefunds.reduce((sum, r) => sum + r.amount, 0)
    );
    const maxRefundablePaise = Math.max(0, payment.amount - totalCommittedOrPendingPaise);

    if (maxRefundablePaise <= 0) {
      throw new AppError(
        "Payment has already been fully refunded or committed.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    let requestedPaise = amount;
    if (isFull || requestedPaise === undefined || requestedPaise === null) {
      requestedPaise = maxRefundablePaise;
    }
    requestedPaise = Math.round(requestedPaise);

    if (requestedPaise <= 0) {
      throw new AppError(
        "Refund amount must be greater than zero.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (requestedPaise > maxRefundablePaise) {
      throw new AppError(
        `Refund amount of ₹${(requestedPaise / 100).toFixed(2)} exceeds maximum refundable balance of ₹${(maxRefundablePaise / 100).toFixed(2)}.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Atomic conditional reservation update on Payment:
    // Ensures concurrent requests cannot exceed payment.amount even without replica set transactions
    const reservedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        $expr: {
          $lte: [
            { $add: [{ $ifNull: ["$committedRefundPaise", 0] }, requestedPaise] },
            "$amount"
          ]
        }
      },
      {
        $inc: { committedRefundPaise: requestedPaise }
      },
      { new: true }
    );

    if (!reservedPayment) {
      const latestPayment = await Payment.findById(payment._id);
      const remainingPaise = Math.max(0, latestPayment.amount - (latestPayment.committedRefundPaise || 0));
      throw new AppError(
        `Refund amount of ₹${(requestedPaise / 100).toFixed(2)} exceeds maximum refundable balance of ₹${(remainingPaise / 100).toFixed(2)}.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const isFullRefund = reservedPayment.committedRefundPaise >= payment.amount;
    const refundType = isFullRefund ? "FULL" : "PARTIAL";
    const refundNumber = this.generateRefundNumber();

    const pendingRefund = await Refund.create({
      refundNumber,
      orderId: order._id,
      paymentId: payment._id,
      userId: order.userId,
      amount: requestedPaise,
      currency: "INR",
      reason: reason || "Customer/Admin requested refund",
      status: "PENDING",
      refundType,
      gateway: "RAZORPAY",
      gatewayPaymentId: payment.gatewayPaymentId,
      idempotencyKey: idempotencyKey || null,
      metadata: {
        orderNumber: order.orderNumber,
        initiatedBy: isAdmin ? "ADMIN" : "USER"
      }
    });

    const refundAmountPaise = requestedPaise;

    // 6. Step B: Invoke Gateway API strictly OUTSIDE database transaction (ADR-29)
    let gatewayRefundId;
    try {
      gatewayRefundId = await this.invokeGatewayRefund({
        gatewayPaymentId: payment.gatewayPaymentId,
        amountInPaise: refundAmountPaise
      });
    } catch (gatewayErr) {
      // On failure, atomically release the reserved capacity on Payment
      await Payment.findByIdAndUpdate(payment._id, {
        $inc: { committedRefundPaise: -refundAmountPaise }
      });

      pendingRefund.status = "FAILED";
      pendingRefund.failureReason = gatewayErr.message || "Gateway refund call failed";
      await pendingRefund.save();

      throw new AppError(
        `Payment gateway refund failed: ${gatewayErr.message}`,
        HTTP_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    // 7. Step C: Short DB transaction to update Refund, Payment, and Order
    return await runInTransaction(async (session) => {
      // Update Refund
      pendingRefund.status = "PROCESSED";
      pendingRefund.gatewayRefundId = gatewayRefundId;
      pendingRefund.processedAt = new Date();
      await pendingRefund.save(session ? { session } : {});

      // Update Payment
      payment.status = refundType === "FULL" ? "REFUNDED" : "PARTIALLY_REFUNDED";
      if (payment.reconciliationStatus === "REFUND_REQUIRED") {
        payment.reconciliationStatus = "SETTLED";
      }
      await payment.save(session ? { session } : {});

      // Update Order
      order.paymentStatus = refundType === "FULL" ? "REFUNDED" : "PARTIALLY_REFUNDED";
      if (["RETURN_APPROVED", "RETURN_INSPECTED"].includes(order.orderStatus)) {
        order.orderStatus = "RETURNED";
      }

      order.statusHistory.push({
        status: order.orderStatus,
        changedAt: new Date(),
        note: `Gateway refund of ₹${(refundAmountPaise / 100).toFixed(2)} processed (Refund ID: ${gatewayRefundId}, Number: ${refundNumber}).`
      });
      await order.save(session ? { session } : {});

      AuditLogger.logFinancialAction({
        action: "ADMIN_INITIATED_REFUND",
        adminId: userId,
        targetUserId: order.userId,
        orderId: order._id,
        paymentId: payment._id,
        amountPaise: refundAmountPaise,
        reason: reason || "Gateway refund processed",
        metadata: {
          refundNumber,
          gatewayRefundId,
          refundType
        }
      });

      return {
        refund: pendingRefund,
        payment,
        order,
        isDuplicate: false
      };
    });
  }

  /**
   * Admin / Automated: Process and Settle REFUND_REQUIRED cancelled orders from Phase 6
   */
  static async processRefundForCancelledOrder({ orderId, adminId }) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (order.orderStatus !== "CANCELLED") {
      throw new AppError(
        `Order status is '${order.orderStatus}'. Only CANCELLED orders can be settled via this reconciliation endpoint.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const payment = await Payment.findOne({ orderId: order._id, gateway: "RAZORPAY" });
    if (!payment) {
      throw new AppError("Payment record not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (payment.status !== "CAPTURED") {
      throw new AppError(
        `Payment is in status '${payment.status}'. Only CAPTURED payments require gateway refund.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const result = await this.createRefund({
      orderId: order._id,
      userId: order.userId,
      amount: payment.amount,
      reason: "Reconciliation: Refund for order cancelled post-capture",
      idempotencyKey: `settle_${order._id.toString()}`,
      isAdmin: true,
      isFull: true
    });

    return result;
  }

  /**
   * Get refunds for an order with Anti-IDOR check
   */
  static async getRefundsByOrderId(orderId, userId, isAdmin = false) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (!isAdmin && order.userId.toString() !== userId.toString()) {
      throw new AppError("Unauthorized access to order refunds.", HTTP_CODES.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }

    const refunds = await Refund.find({ orderId }).sort({ createdAt: -1 });
    return refunds;
  }

  /**
   * Admin: List all refunds with pagination and status filter
   */
  static async getAllRefunds({ page = 1, limit = 20, status, search } = {}) {
    const filter = {};
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { refundNumber: { $regex: search, $options: "i" } },
        { gatewayPaymentId: { $regex: search, $options: "i" } },
        { gatewayRefundId: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (page - 1) * limit;
    const [refunds, total] = await Promise.all([
      Refund.find(filter)
        .populate("orderId", "orderNumber priceSummary orderStatus")
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Refund.countDocuments(filter)
    ]);

    return {
      refunds,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = RefundService;
