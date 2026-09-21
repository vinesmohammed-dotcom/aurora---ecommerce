const mongoose = require("mongoose");
const Order = require("./order.model");
const Cart = require("../cart/cart.model");
const StockService = require("../products/stock.service");
const CheckoutService = require("../checkout/checkout.service");
const CouponService = require("../coupons/coupon.service");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

const VALID_STATUS_TRANSITIONS = {
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
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
   * Place Cash on Delivery (COD) Order
   * Authoritative calculation -> Multi-item atomic stock deduction -> Order creation -> Cart clearance
   */
  static async createCodOrder({ userId, addressId, couponCode = null, idempotencyKey = null }) {
    // 1. Idempotency Check: prevent duplicate order from double-clicks or retried network requests
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey, userId });
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

    // 3. Multi-item Atomic Stock Deduction with Automatic Compensation Rollback
    // If ANY item runs out of stock midway, all previously deducted items are restored immediately.
    const successfullyDecremented = [];
    let stockFailureItem = null;

    for (const item of calculation.items) {
      const success = await StockService.decrementVariantStock({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity
      });

      if (success) {
        successfullyDecremented.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity
        });
      } else {
        stockFailureItem = item;
        break;
      }
    }

    // Rollback compensation if any item failed
    if (stockFailureItem) {
      for (const item of successfullyDecremented) {
        await StockService.restoreVariantStock({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity
        });
      }

      throw new AppError(
        `Insufficient stock for '${stockFailureItem.name}'. Order placement aborted and no inventory was reserved.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 4. Create Immutable Snapshots
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

    const order = await Order.create({
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
    });

    // 5. Post-Order Side Effects: record coupon redemption & clear cart
    if (calculation.appliedCoupon) {
      await CouponService.recordCouponUsage({
        code: calculation.appliedCoupon.code,
        userId
      });
    }

    // Clear user's cart
    await Cart.updateOne({ userId }, { $set: { items: [] } });

    return order;
  }

  /**
   * Cancel Order (Customer or Admin) with Idempotent Stock Restoration
   */
  static async cancelOrder({ orderId, userId, reason = "Customer cancelled", isAdmin = false }) {
    const query = isAdmin ? { _id: orderId } : { _id: orderId, userId };
    const order = await Order.findOne(query);

    if (!order) {
      throw new AppError(
        "Order not found or access denied.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Idempotent check: if already cancelled, return existing state
    if (order.orderStatus === "CANCELLED") {
      return order;
    }

    if (!["CONFIRMED", "PROCESSING"].includes(order.orderStatus)) {
      throw new AppError(
        `Cannot cancel order with status '${order.orderStatus}'. Orders can only be cancelled before dispatch.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Restore stock for all items
    for (const item of order.items) {
      await StockService.restoreVariantStock({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity
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

    await order.save();
    return order;
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

module.exports = OrderService;
