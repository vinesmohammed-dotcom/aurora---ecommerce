const mongoose = require("mongoose");
const Order = require("./order.model");
const Payment = require("../payments/payment.model");
const Cart = require("../cart/cart.model");
const StockService = require("../products/stock.service");
const CheckoutService = require("../checkout/checkout.service");
const CouponService = require("../coupons/coupon.service");
const { runInTransaction } = require("../../utils/transaction");
const AuditLogger = require("../../utils/auditLogger");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

// Authoritative Payment Reservation TTL: 15 minutes
const ORDER_PAYMENT_RESERVATION_TTL_MS = 15 * 60 * 1000;
// Authoritative Return Window: 7 days
const ORDER_RETURN_WINDOW_DAYS = 7;

const VALID_STATUS_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURN_APPROVED", "RETURN_REJECTED", "DELIVERED"],
  RETURN_APPROVED: ["RETURN_RECEIVED"],
  RETURN_RECEIVED: ["RETURN_INSPECTED"],
  RETURN_INSPECTED: ["RETURNED", "DELIVERED"],
  RETURN_REJECTED: [],
  RETURNED: [],
  CANCELLED: []
};

class OrderService {
  /**
   * Helper to generate human-readable unique order number
   */
  static generateOrderNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${timestamp}-${randomSuffix}`;
  }

  /**
   * Place Cash on Delivery (COD) Order using native MongoDB Multi-Document Transaction
   * Authoritative calculation -> Atomic Stock Reservation + Order Snapshot + Coupon Redemption + Cart Clearance
   */
  static async createCodOrder({ userId, addressId, couponCode = null, idempotencyKey = null }) {
    // 1. Durable Idempotency Check: prevent duplicate order from double-clicks or retried network requests
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ userId, idempotencyKey });
      if (existingOrder) {
        return existingOrder;
      }
    }

    // 2. Authoritative calculation pipeline (NEVER trust client payload)
    const calculation = await CheckoutService.calculateCheckoutSummary({
      userId,
      addressId,
      couponCode
    });

    if (!calculation.shippingAddress) {
      throw new AppError(
        "A valid delivery address is required to place an order.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (!calculation.items || calculation.items.length === 0) {
      throw new AppError(
        "Your cart is empty. Cannot place an empty order.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 3. Coordinate multi-document operations inside runInTransaction
    return await runInTransaction(async (session) => {
      // Re-verify idempotency within session to guard against concurrent submissions
      if (idempotencyKey) {
        const existingOrder = await Order.findOne({ userId, idempotencyKey }).session(session);
        if (existingOrder) {
          return existingOrder;
        }
      }

      const successfullyDecremented = [];
      let stockFailureItem = null;

      // Step A: Atomically decrement stock for all items within the transaction
      for (const item of calculation.items) {
        const decremented = await StockService.decrementVariantStock({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          session
        });

        if (decremented) {
          successfullyDecremented.push(item);
        } else {
          stockFailureItem = item;
          break;
        }
      }

      if (stockFailureItem) {
        // In standalone environment without replica set, execute compensation rollback
        if (!session && successfullyDecremented.length > 0) {
          for (const item of successfullyDecremented) {
            await StockService.restoreVariantStock({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity
            });
          }
        }

        throw new AppError(
          `Insufficient stock for '${stockFailureItem.name}'. Order placement aborted and no inventory was reserved.`,
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Step B: Create Immutable Snapshots
      const addressSnapshot = {
        fullName: calculation.shippingAddress.fullName,
        phone: calculation.shippingAddress.phone,
        addressLine1: calculation.shippingAddress.addressLine1,
        addressLine2: calculation.shippingAddress.addressLine2 || "",
        city: calculation.shippingAddress.city,
        state: calculation.shippingAddress.state,
        postalCode: calculation.shippingAddress.postalCode,
        country: calculation.shippingAddress.country
      };

      const itemSnapshots = calculation.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        name: item.name,
        slug: item.slug,
        image: item.image,
        attributes: item.attributes,
        unitPrice: item.unitPrice,
        offer: item.offer
          ? {
              name: item.offer.name,
              targetType: item.offer.targetType,
              discountPercentage: item.offer.discountPercentage
            }
          : null,
        discountedUnitPrice: item.discountedUnitPrice,
        quantity: item.quantity,
        itemTotal: item.itemTotal
      }));

      const priceSummarySnapshot = {
        grossSubtotal: calculation.summary.grossSubtotal,
        offerDiscountTotal: calculation.summary.offerDiscountTotal,
        netSubtotal: calculation.summary.netSubtotal,
        couponDiscount: calculation.summary.couponDiscount,
        shippingFee: calculation.summary.shippingFee,
        grandTotal: calculation.summary.grandTotal
      };

      const orderNumber = this.generateOrderNumber();

      const [order] = await Order.create(
        [
          {
            orderNumber,
            userId,
            shippingAddress: addressSnapshot,
            items: itemSnapshots,
            priceSummary: priceSummarySnapshot,
            appliedCoupon: calculation.appliedCoupon
              ? {
                  code: calculation.appliedCoupon.code,
                  discountType: calculation.appliedCoupon.discountType,
                  discountValue: calculation.appliedCoupon.discountValue,
                  discountAmount: calculation.appliedCoupon.discountAmount
                }
              : null,
            paymentMethod: "COD",
            paymentStatus: "PENDING",
            orderStatus: "CONFIRMED",
            statusHistory: [
              {
                status: "CONFIRMED",
                changedAt: new Date(),
                note: "Order confirmed via Cash on Delivery."
              }
            ],
            idempotencyKey: idempotencyKey || null
          }
        ],
        session ? { session } : {}
      );

      // Step C: Atomically record coupon redemption within transaction
      if (calculation.appliedCoupon) {
        await CouponService.recordCouponUsage({
          code: calculation.appliedCoupon.code,
          userId,
          session
        });
      }

      // Step D: Atomically clear user's cart within transaction
      await Cart.updateOne({ userId }, { $set: { items: [] } }, session ? { session } : {});

      return order;
    });
  }

  /**
   * Cancel Order (Customer or Admin) with Native MongoDB Transaction
   * Coordinates order state transition and stock restoration atomically.
   */
  static async cancelOrder({ orderId, userId, reason = "Customer cancelled", isAdmin = false }) {
    const query = isAdmin ? { _id: orderId } : { _id: orderId, userId };

    return await runInTransaction(async (session) => {
      const order = await Order.findOne(query).session(session);

      if (!order) {
        throw new AppError(
          "Order not found or access denied.",
          HTTP_CODES.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Idempotent check: if already cancelled, return existing state with ZERO stock restored
      if (order.orderStatus === "CANCELLED") {
        return order;
      }

      if (!["CONFIRMED", "PROCESSING", "PENDING"].includes(order.orderStatus)) {
        throw new AppError(
          `Cannot cancel order with status '${order.orderStatus}'. Orders can only be cancelled before dispatch.`,
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Restore stock for all items within the transaction
      for (const item of order.items) {
        await StockService.restoreVariantStock({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          session
        });
      }

      order.orderStatus = "CANCELLED";
      order.cancellationReason = reason;
      order.cancelledAt = new Date();
      order.statusHistory.push({
        status: "CANCELLED",
        changedAt: new Date(),
        note: reason
      });

      await order.save(session ? { session } : {});

      // Cancel any active payment records attached to this order
      await Payment.updateMany(
        {
          orderId: order._id,
          status: { $in: ["CREATED", "FAILED"] }
        },
        {
          $set: { status: "CANCELLED", failureReason: `Order cancelled: ${reason}` }
        },
        session ? { session } : {}
      );

      return order;
    });
  }

  /**
   * Safe, Idempotent Payment Stock Reservation Cleanup Engine
   * Identifies expired pending-payment orders and releases reserved inventory.
   *
   * Idempotency guarantee:
   * Uses conditional atomic state transition { _id, orderStatus: "PENDING" } -> "CANCELLED".
   * If run twice or concurrently, only the worker that succeeds in updating "PENDING" -> "CANCELLED"
   * executes stock restoration.
   */
  static async cleanupExpiredReservations() {
    const now = new Date();
    const expiredOrders = await Order.find({
      paymentMethod: "ONLINE_RAZORPAY",
      orderStatus: "PENDING",
      paymentStatus: { $in: ["PENDING", "FAILED"] },
      paymentExpiresAt: { $lt: now }
    });

    const cleanedUpOrderIds = [];

    for (const candidate of expiredOrders) {
      // Atomic conditional update guarantees exactly-once stock restoration even under concurrency
      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: candidate._id,
          orderStatus: "PENDING"
        },
        {
          $set: {
            orderStatus: "CANCELLED",
            paymentStatus: "EXPIRED",
            cancellationReason: "Payment reservation expired",
            cancelledAt: now
          },
          $push: {
            statusHistory: {
              status: "CANCELLED",
              changedAt: now,
              note: "Payment reservation expired. Reserved inventory safely released."
            }
          }
        },
        { new: true }
      );

      // If already transitioned by another worker/request, skip restoring stock
      if (!updatedOrder) {
        continue;
      }

      // Safely restore stock for all line items
      for (const item of updatedOrder.items) {
        await StockService.restoreVariantStock({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity
        });
      }

      // Transition associated payment records to EXPIRED
      await Payment.updateMany(
        {
          orderId: updatedOrder._id,
          status: { $in: ["CREATED", "FAILED"] }
        },
        {
          $set: {
            status: "EXPIRED",
            failureReason: "Payment reservation expired"
          }
        }
      );

      cleanedUpOrderIds.push(updatedOrder._id.toString());
    }

    return {
      cleanedCount: cleanedUpOrderIds.length,
      orderIds: cleanedUpOrderIds
    };
  }

  /**
   * Admin Status Transition with State Machine Validation
   */
  static async updateOrderStatus({ orderId, newStatus, note = "" }) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const currentStatus = order.orderStatus;
    const allowedNextStatuses = VALID_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedNextStatuses.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed: [${allowedNextStatuses.join(", ")}].`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // If transitioning to CANCELLED, restore stock
    if (newStatus === "CANCELLED") {
      for (const item of order.items) {
        await StockService.restoreVariantStock({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity
        });
      }
      order.cancelledAt = new Date();
      order.cancellationReason = note || "Cancelled by administrator";
    }

    // If COD order reaches DELIVERED, paymentStatus automatically transitions to COMPLETED
    if (newStatus === "DELIVERED" && order.paymentMethod === "COD") {
      order.paymentStatus = "COMPLETED";
    }

    order.orderStatus = newStatus;
    order.statusHistory.push({
      status: newStatus,
      changedAt: new Date(),
      note: note || `Status updated to ${newStatus}`
    });

    await order.save();
    return order;
  }

  /**
   * Customer: Request Return for a Delivered Order within Allowed Return Window (7 Days)
   */
  static async requestReturn({ orderId, userId, reason }) {
    if (!reason || !reason.trim()) {
      throw new AppError(
        "A reason is required to submit a return request.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      throw new AppError(
        "Order not found or access denied.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (order.orderStatus !== "DELIVERED") {
      throw new AppError(
        `Returns can only be requested for DELIVERED orders. Current status: '${order.orderStatus}'.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check 7-day return window from last status update
    const deliveredEntry = order.statusHistory.slice().reverse().find((h) => h.status === "DELIVERED");
    const deliveryDate = deliveredEntry ? new Date(deliveredEntry.changedAt) : new Date(order.updatedAt);
    const daysSinceDelivery = (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDelivery > ORDER_RETURN_WINDOW_DAYS) {
      throw new AppError(
        `Return window of ${ORDER_RETURN_WINDOW_DAYS} days has expired for this order.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (order.returnRequest && ["REQUESTED", "APPROVED"].includes(order.returnRequest.status)) {
      throw new AppError(
        `A return request is already in state '${order.returnRequest.status}'.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    order.returnRequest = {
      status: "REQUESTED",
      reason: reason.trim(),
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: ""
    };
    order.orderStatus = "RETURN_REQUESTED";
    order.statusHistory.push({
      status: "RETURN_REQUESTED",
      changedAt: new Date(),
      note: `Customer requested return: ${reason.trim()}`
    });

    await order.save();
    return order;
  }

  /**
   * Admin: Review and Approve or Reject a Return Request
   */
  static async reviewReturnRequest({ orderId, adminId, decision, rejectionReason = "" }) {
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      throw new AppError(
        "Decision must be either 'APPROVED' or 'REJECTED'.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (!order.returnRequest || order.returnRequest.status !== "REQUESTED") {
      throw new AppError(
        "Order does not have a pending return request awaiting review.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (decision === "APPROVED") {
      order.returnRequest.status = "APPROVED";
      order.returnRequest.reviewedAt = new Date();
      order.returnRequest.reviewedBy = adminId;
      order.orderStatus = "RETURN_APPROVED";

      // If online payment was completed, flag paymentStatus as REFUND_PENDING
      if (order.paymentMethod === "ONLINE_RAZORPAY" && order.paymentStatus === "COMPLETED") {
        order.paymentStatus = "REFUND_PENDING";
      }

      // DO NOT restore stock here! The customer still has the physical goods.
      // Stock restoration occurs strictly after item is received and inspection passes.

      order.statusHistory.push({
        status: "RETURN_APPROVED",
        changedAt: new Date(),
        note: "Return request approved by administrator. Awaiting physical item return to warehouse."
      });

      AuditLogger.logFinancialAction({
        action: "ADMIN_APPROVED_RETURN",
        adminId,
        targetUserId: order.userId,
        orderId: order._id,
        reason: "Return request approved by administrator",
        metadata: { orderNumber: order.orderNumber }
      });
    } else {
      order.returnRequest.status = "REJECTED";
      order.returnRequest.reviewedAt = new Date();
      order.returnRequest.reviewedBy = adminId;
      order.returnRequest.rejectionReason = rejectionReason || "Return request rejected by administrator.";
      order.orderStatus = "DELIVERED"; // Revert to delivered state
      order.statusHistory.push({
        status: "DELIVERED",
        changedAt: new Date(),
        note: `Return request rejected: ${order.returnRequest.rejectionReason}`
      });

      AuditLogger.logFinancialAction({
        action: "ADMIN_REJECTED_RETURN",
        adminId,
        targetUserId: order.userId,
        orderId: order._id,
        reason: order.returnRequest.rejectionReason,
        metadata: { orderNumber: order.orderNumber }
      });
    }

    await order.save();
    return order;
  }

  /**
   * Admin: Mark Returned Item as Received at Warehouse
   */
  static async markReturnReceived({ orderId, adminId }) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (order.orderStatus !== "RETURN_APPROVED") {
      throw new AppError(
        `Order status is '${order.orderStatus}'. Only 'RETURN_APPROVED' orders can be marked as received.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    order.returnRequest.status = "RECEIVED";
    order.returnRequest.receivedAt = new Date();
    order.returnRequest.receivedBy = adminId;
    order.orderStatus = "RETURN_RECEIVED";
    order.statusHistory.push({
      status: "RETURN_RECEIVED",
      changedAt: new Date(),
      note: "Item received at warehouse. Awaiting quality inspection."
    });

    await order.save();
    return order;
  }

  /**
   * Admin: Quality Inspection for Returned Item & Restocking Decision
   *
   * Only restores stock if:
   * 1. Inspection passed
   * 2. restock flag is true
   * 3. Inventory has not already been restored (idempotent guard)
   *
   * For damaged / non-restockable items, stock is NOT restored to sellable inventory.
   */
  static async inspectReturnItem({ orderId, adminId, inspectionPassed, restock = true, notes = "" }) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (order.orderStatus !== "RETURN_RECEIVED") {
      throw new AppError(
        `Order status is '${order.orderStatus}'. Only 'RETURN_RECEIVED' orders can be inspected.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const passed = Boolean(inspectionPassed);
    const shouldRestock = passed && Boolean(restock);

    order.returnRequest.status = passed ? "INSPECTED_PASSED" : "INSPECTED_FAILED";
    order.returnRequest.inspectionDetails = {
      inspectedAt: new Date(),
      inspectedBy: adminId,
      passed,
      restocked: shouldRestock,
      notes: (notes || "").trim()
    };
    order.orderStatus = "RETURN_INSPECTED";

    // Restore stock ONLY if inspection passed and restock is true AND not previously restored
    if (shouldRestock && !order.returnRequest.inventoryRestored) {
      for (const item of order.items) {
        await StockService.restoreVariantStock({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity
        });
      }
      order.returnRequest.inventoryRestored = true;
      order.statusHistory.push({
        status: "RETURN_INSPECTED",
        changedAt: new Date(),
        note: `Inspection passed. Sellable inventory restored: ${notes || "Item meets return criteria."}`
      });
    } else {
      order.statusHistory.push({
        status: "RETURN_INSPECTED",
        changedAt: new Date(),
        note: passed
          ? `Inspection passed but item not restocked: ${notes || "Item non-restockable per policy."}`
          : `Inspection failed. Sellable inventory NOT restored: ${notes || "Item damaged or incomplete."}`
      });
    }

    await order.save();
    return order;
  }

  /**
   * Customer: Get order history with pagination
   */
  static async getMyOrders(userId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      Order.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ userId })
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Customer: Get single order by ID with anti-IDOR verification
   */
  static async getOrderById(orderId, userId, isAdmin = false) {
    const query = isAdmin ? { _id: orderId } : { _id: orderId, userId };
    const order = await Order.findOne(query);

    if (!order) {
      throw new AppError(
        "Order not found or access denied.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    return order;
  }

  /**
   * Admin: List all orders with filters and pagination
   */
  static async getAllOrders({ page = 1, limit = 20, status, search } = {}) {
    const filter = {};
    if (status) {
      filter.orderStatus = status;
    }
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "shippingAddress.fullName": { $regex: search, $options: "i" } },
        { "shippingAddress.phone": { $regex: search, $options: "i" } }
      ];
    }

    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter)
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

OrderService.ORDER_PAYMENT_RESERVATION_TTL_MS = ORDER_PAYMENT_RESERVATION_TTL_MS;
OrderService.ORDER_RETURN_WINDOW_DAYS = ORDER_RETURN_WINDOW_DAYS;

module.exports = OrderService;


