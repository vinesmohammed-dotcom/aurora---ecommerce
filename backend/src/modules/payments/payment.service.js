const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("./payment.model");
const PaymentEvent = require("./paymentEvent.model");
const Order = require("../orders/order.model");
const User = require("../users/user.model");
const Cart = require("../cart/cart.model");
const StockService = require("../products/stock.service");
const CheckoutService = require("../checkout/checkout.service");
const CouponService = require("../coupons/coupon.service");
const OrderService = require("../orders/order.service");
const RazorpayService = require("../../services/razorpay.service");
const { runInTransaction } = require("../../utils/transaction");
const env = require("../../config/env");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

// Explicit Payment State Transition Map (Requirement 6)
const VALID_PAYMENT_TRANSITIONS = {
  CREATED: ["AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED", "EXPIRED"],
  AUTHORIZED: ["CAPTURED", "FAILED", "CANCELLED", "EXPIRED"],
  CAPTURED: ["REFUNDED", "PARTIALLY_REFUNDED"], // Terminal for charge intake; only refunds allowed
  FAILED: ["CREATED", "CAPTURED"],             // Can retry (new session) or receive late capture
  CANCELLED: ["CAPTURED"],                    // Late capture triggers REFUND_REQUIRED reconciliation
  EXPIRED: ["CAPTURED"],                      // Late capture triggers REFUND_REQUIRED reconciliation
  REFUNDED: [],
  PARTIALLY_REFUNDED: ["REFUNDED"]
};

class PaymentService {
  static razorpayService = RazorpayService;
  /**
   * Helper to generate a mock Razorpay order ID for test/offline mode
   */
  static generateGatewayOrderId() {
    return `order_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Helper to generate a mock Razorpay payment ID for test mode
   */
  static generateGatewayPaymentId() {
    return `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Helper to compute constant-time HMAC-SHA256 signature verification
   *
   * @param {string} payload - Data to sign (order_id|payment_id or rawBody)
   * @param {string} secret - Secret key used for signing
   * @param {string} receivedSignature - Signature string sent by client or webhook
   * @returns {boolean} True if signature matches, false otherwise
   */
  static verifyHmacSignature(payload, secret, receivedSignature) {
    if (!payload || !secret || !receivedSignature) return false;

    try {
      const generatedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const generatedBuffer = Buffer.from(generatedSignature, "utf-8");
      const receivedBuffer = Buffer.from(receivedSignature, "utf-8");

      if (generatedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(generatedBuffer, receivedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Create Online Payment & Reserve Stock (Upfront Reservation Architecture)
   *
   * 1. Calculate authoritative totals from MongoDB catalog
   * 2. Reserve variant stock atomically in transaction (prevents overselling)
   * 3. Create internal Order with orderStatus: "PENDING", paymentStatus: "PENDING", paymentMethod: "ONLINE_RAZORPAY"
   * 4. Clear user's Cart
   * 5. Create Razorpay order (or generate deterministic order ID)
   * 6. Create internal Payment record
   * 7. Return safe checkout payload to client (Key ID, amount, order ID, prefill)
   */
  static async createOnlinePayment({ userId, addressId, couponCode = null, idempotencyKey = null }) {
    // 1. Durable Idempotency Check: if user resubmits identical key, return existing order & payment
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ userId, idempotencyKey });
      if (existingOrder) {
        // If existing order has expired, don't return an expired checkout session
        if (existingOrder.paymentExpiresAt && new Date() > existingOrder.paymentExpiresAt) {
          await OrderService.cleanupExpiredReservations();
          throw new AppError(
            "The payment reservation for this checkout has expired. Please try again with a new checkout.",
            HTTP_CODES.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        const existingPayment = await Payment.findOne({
          orderId: existingOrder._id,
          status: { $in: ["CREATED", "CAPTURED"] }
        });
        if (existingPayment) {
          const user = await User.findById(userId);
          return {
            order: existingOrder,
            payment: existingPayment,
            checkoutInfo: {
              orderId: existingOrder._id,
              orderNumber: existingOrder.orderNumber,
              paymentId: existingPayment._id,
              razorpayOrderId: existingPayment.gatewayOrderId,
              amount: existingPayment.amount,
              currency: existingPayment.currency,
              paymentExpiresAt: existingOrder.paymentExpiresAt,
              keyId: env.RAZORPAY_KEY_ID,
              prefill: {
                name: user ? user.name : "",
                email: user ? user.email : "",
                contact: existingOrder.shippingAddress.phone
              }
            }
          };
        }
      }
    }

    // 2. Authoritative checkout summary calculation
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
        "Your cart is empty. Cannot initiate payment for an empty cart.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentExpiresAt = new Date(Date.now() + OrderService.ORDER_PAYMENT_RESERVATION_TTL_MS);

    // 3. Atomically reserve stock and create internal Order in transaction
    const order = await runInTransaction(async (session) => {
      const successfullyDecremented = [];
      let stockFailureItem = null;

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
          `Insufficient stock for '${stockFailureItem.name}'. Payment creation aborted and inventory was not reserved.`,
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

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

      const [newOrder] = await Order.create(
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
            paymentMethod: "ONLINE_RAZORPAY",
            paymentStatus: "PENDING",
            paymentExpiresAt,
            orderStatus: "PENDING",
            statusHistory: [
              {
                status: "PENDING",
                changedAt: new Date(),
                note: "Order created, awaiting online payment confirmation."
              }
            ],
            idempotencyKey: idempotencyKey || null
          }
        ],
        session ? { session } : {}
      );

      // Clear user's cart
      await Cart.updateOne({ userId }, { $set: { items: [] } }, session ? { session } : {});

      return newOrder;
    });

    // 4. External Gateway Integration (executed OUTSIDE database transaction)
    let gatewayOrder;
    let payment;
    const amountInPaise = Math.round(calculation.summary.grandTotal * 100);

    try {
      // Create authoritative order directly with official Razorpay Orders API
      const gatewayClient = PaymentService.razorpayService || RazorpayService;
      gatewayOrder = await gatewayClient.createOrder({
        amount: amountInPaise,
        currency: "INR",
        receipt: order.orderNumber,
        notes: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          userId: userId.toString()
        }
      });

      // 5. Create Payment entity in MongoDB with official provider-generated order ID
      payment = await Payment.create({
        orderId: order._id,
        userId,
        gateway: "RAZORPAY",
        gatewayOrderId: gatewayOrder.id,
        amount: amountInPaise,
        currency: "INR",
        status: "CREATED",
        verificationStatus: "PENDING",
        metadata: {
          orderNumber: order.orderNumber,
          itemCount: order.items.length,
          razorpayReceipt: gatewayOrder.receipt
        }
      });
    } catch (gatewayErr) {
      // Safe Compensation Rollback outside DB transaction (Requirement 13 & 14)
      for (const item of order.items) {
        await StockService.restoreVariantStock({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity
        });
      }

      order.orderStatus = "CANCELLED";
      order.paymentStatus = "FAILED";
      order.cancellationReason = `Gateway initialization failed: ${gatewayErr.message}`;
      order.cancelledAt = new Date();
      order.statusHistory.push({
        status: "CANCELLED",
        changedAt: new Date(),
        note: "Gateway order creation failed. Reserved inventory safely restored."
      });
      await order.save();

      throw new AppError(
        `Failed to initialize payment gateway: ${gatewayErr.message}`,
        gatewayErr.statusCode || HTTP_CODES.INTERNAL_SERVER_ERROR,
        gatewayErr.errorCode || ERROR_CODES.INTERNAL_ERROR
      );
    }

    const user = await User.findById(userId);

    // 6. Return safe checkout payload with verified provider order ID
    return {
      order,
      payment,
      checkoutInfo: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentId: payment._id,
        razorpayOrderId: gatewayOrder.id,
        amount: amountInPaise,
        currency: "INR",
        paymentExpiresAt: order.paymentExpiresAt,
        keyId: env.RAZORPAY_KEY_ID,
        prefill: {
          name: user ? user.name : "",
          email: user ? user.email : "",
          contact: calculation.shippingAddress.phone
        }
      }
    };
  }

  /**
   * Verify Client Payment Callback Signature & Synchronize State
   *
   * @param {Object} params
   * @param {string} params.userId - Authenticated user ID (Anti-IDOR)
   * @param {string} params.razorpayOrderId - Gateway order ID
   * @param {string} params.razorpayPaymentId - Gateway payment ID
   * @param {string} params.razorpaySignature - Cryptographic HMAC signature
   */
  static async verifyPaymentSignature({ userId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    // 1. Locate internal Payment record using server-stored gatewayOrderId
    const payment = await Payment.findOne({ gatewayOrderId: razorpayOrderId });
    if (!payment) {
      throw new AppError(
        "Invalid payment verification request. Gateway order ID not found.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // 2. Anti-IDOR ownership check
    if (payment.userId.toString() !== userId.toString()) {
      throw new AppError(
        "Unauthorized access to payment record.",
        HTTP_CODES.FORBIDDEN,
        ERROR_CODES.FORBIDDEN
      );
    }

    // 3. Locate corresponding internal Order
    const order = await Order.findById(payment.orderId);
    if (!order) {
      throw new AppError("Associated order not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // 4. Idempotency Check: if payment is already captured, return cleanly without duplicating actions
    if (payment.status === "CAPTURED") {
      if (order.orderStatus === "CONFIRMED") {
        return { order, payment, isDuplicate: true };
      }
      if (order.orderStatus === "CANCELLED") {
        return { order, payment, isDuplicate: true, refundRequired: true };
      }
    }

    // Assert payment not already captured with a different transaction ID
    if (payment.gatewayPaymentId && payment.gatewayPaymentId !== razorpayPaymentId) {
      throw new AppError(
        "Payment has already been processed with a different payment ID.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 5. Cryptographic Signature Verification
    // Expected signature = HMAC-SHA256(razorpayOrderId + "|" + razorpayPaymentId, RAZORPAY_KEY_SECRET)
    // Server-side authoritative gatewayOrderId is strictly used (do NOT trust client-supplied order ID)
    const payload = `${payment.gatewayOrderId}|${razorpayPaymentId}`;
    const isValid = this.verifyHmacSignature(payload, env.RAZORPAY_KEY_SECRET, razorpaySignature);

    if (!isValid) {
      // Mark payment failed
      payment.status = "FAILED";
      payment.verificationStatus = "FAILED";
      payment.failureReason = "Signature mismatch";
      await payment.save();

      if (order.orderStatus === "PENDING") {
        order.paymentStatus = "FAILED";
        await order.save();
      }

      throw new AppError(
        "Payment verification failed: invalid signature.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 6. Verification checks: amount, currency, and payment state (Requirement 4)
    if (payment.amount !== Math.round(order.priceSummary.grandTotal * 100)) {
      throw new AppError(
        "Payment verification failed: payment amount mismatch.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (payment.currency !== "INR") {
      throw new AppError(
        "Payment verification failed: payment currency mismatch.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (payment.status === "REFUNDED") {
      throw new AppError(
        "Payment record is in terminal refunded state.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 7. Check Order state: Handle CANCELLED / EXPIRED order with captured payment (Requirement 5)
    if (order.orderStatus === "CANCELLED") {
      // Order was cancelled or expired before callback completed. Preserve financial fact!
      return await runInTransaction(async (session) => {
        payment.status = "CAPTURED";
        payment.gatewayPaymentId = razorpayPaymentId;
        payment.verificationStatus = "VERIFIED";
        payment.reconciliationStatus = "REFUND_REQUIRED";
        await payment.save(session ? { session } : {});

        order.paymentStatus = "REFUND_REQUIRED";
        order.statusHistory.push({
          status: "CANCELLED",
          changedAt: new Date(),
          note: `Payment captured after order cancellation (Payment ID: ${razorpayPaymentId}). Reconciliation marked REFUND_REQUIRED.`
        });
        await order.save(session ? { session } : {});

        return { order, payment, isDuplicate: false, refundRequired: true };
      });
    }

    if (order.orderStatus !== "PENDING" && order.orderStatus !== "CONFIRMED") {
      throw new AppError(
        `Order is in invalid state '${order.orderStatus}' for payment verification.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 8. Atomic state synchronization within transaction (Normal Confirmation Flow)
    return await runInTransaction(async (session) => {
      // Update Payment
      payment.status = "CAPTURED";
      payment.gatewayPaymentId = razorpayPaymentId;
      payment.verificationStatus = "VERIFIED";
      await payment.save(session ? { session } : {});

      // Update Order: transition to CONFIRMED & COMPLETED
      // NOTICE: Stock was ALREADY reserved at order creation. DO NOT decrement stock again!
      order.orderStatus = "CONFIRMED";
      order.paymentStatus = "COMPLETED";
      order.statusHistory.push({
        status: "CONFIRMED",
        changedAt: new Date(),
        note: `Payment captured successfully via Razorpay (Payment ID: ${razorpayPaymentId}).`
      });
      await order.save(session ? { session } : {});

      // Record coupon usage if applied
      if (order.appliedCoupon && order.appliedCoupon.code) {
        await CouponService.recordCouponUsage({
          code: order.appliedCoupon.code,
          userId,
          session
        });
      }

      return { order, payment, isDuplicate: false };
    });
  }

  /**
   * Payment Retry Engine
   * Allows customer to retry paying for an unpaid/failed order without reconstructing cart.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.orderId
   */
  static async retryPayment({ userId, orderId }) {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      throw new AppError(
        "Order not found or access denied.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Allowlist: order must be PENDING, paymentStatus PENDING or FAILED
    if (order.orderStatus !== "PENDING" || !["PENDING", "FAILED"].includes(order.paymentStatus)) {
      throw new AppError(
        `Cannot retry payment for order with status '${order.orderStatus}' and payment status '${order.paymentStatus}'.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (order.paymentMethod !== "ONLINE_RAZORPAY") {
      throw new AppError(
        "Payment retry is only supported for online payment orders.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Reservation Expiration Check (Requirement 9 & 10)
    // If reservation has expired, do NOT allow retry using the expired reservation!
    if (order.paymentExpiresAt && new Date() > order.paymentExpiresAt) {
      if (order.orderStatus === "PENDING") {
        for (const item of order.items) {
          await StockService.restoreVariantStock({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity
          });
        }
        order.orderStatus = "CANCELLED";
        order.paymentStatus = "EXPIRED";
        order.cancellationReason = "Payment reservation expired";
        order.cancelledAt = new Date();
        order.statusHistory.push({
          status: "CANCELLED",
          changedAt: new Date(),
          note: "Payment reservation expired during retry attempt. Stock safely released."
        });
        await order.save();

        await Payment.updateMany(
          { orderId: order._id, status: { $in: ["CREATED", "FAILED"] } },
          { $set: { status: "EXPIRED", failureReason: "Payment reservation expired" } }
        );
      }

      throw new AppError(
        "Payment reservation has expired and inventory has been released. Please place a new order from your cart.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Allowlist: order must be PENDING, paymentStatus PENDING or FAILED
    if (order.orderStatus !== "PENDING" || !["PENDING", "FAILED"].includes(order.paymentStatus)) {
      throw new AppError(
        `Cannot retry payment for order with status '${order.orderStatus}' and payment status '${order.paymentStatus}'.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Create a new Razorpay gateway order on provider API for the existing amount
    const amountInPaise = Math.round(order.priceSummary.grandTotal * 100);
    let gatewayOrder;
    let payment;

    try {
      const gatewayClient = PaymentService.razorpayService || RazorpayService;
      gatewayOrder = await gatewayClient.createOrder({
        amount: amountInPaise,
        currency: "INR",
        receipt: `${order.orderNumber}-R`,
        notes: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          userId: userId.toString(),
          isRetry: "true"
        }
      });

      payment = await Payment.create({
        orderId: order._id,
        userId,
        gateway: "RAZORPAY",
        gatewayOrderId: gatewayOrder.id,
        amount: amountInPaise,
        currency: "INR",
        status: "CREATED",
        verificationStatus: "PENDING",
        metadata: {
          isRetry: true,
          orderNumber: order.orderNumber,
          razorpayReceipt: gatewayOrder.receipt
        }
      });
    } catch (gatewayErr) {
      throw new AppError(
        `Failed to initialize payment gateway retry: ${gatewayErr.message}`,
        gatewayErr.statusCode || HTTP_CODES.INTERNAL_SERVER_ERROR,
        gatewayErr.errorCode || ERROR_CODES.INTERNAL_ERROR
      );
    }

    const user = await User.findById(userId);

    return {
      order,
      payment,
      checkoutInfo: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        paymentId: payment._id,
        razorpayOrderId: gatewayOrder.id,
        amount: amountInPaise,
        currency: "INR",
        paymentExpiresAt: order.paymentExpiresAt,
        keyId: env.RAZORPAY_KEY_ID,
        prefill: {
          name: user ? user.name : "",
          email: user ? user.email : "",
          contact: order.shippingAddress.phone
        }
      }
    };
  }

  /**
   * Process Razorpay Webhook Event with Raw Body HMAC Verification & Idempotency
   *
   * @param {Object} params
   * @param {Buffer} params.rawBody - Pristine unparsed request body buffer
   * @param {string} params.signature - X-Razorpay-Signature header
   * @param {string} params.eventId - x-razorpay-event-id header
   * @param {Object} params.eventData - Parsed webhook payload
   */
  static async processWebhook({ rawBody, signature, eventId, eventData }) {
    // 1. Raw body cryptographic signature verification
    const isValid = this.verifyHmacSignature(rawBody, env.RAZORPAY_WEBHOOK_SECRET, signature);
    if (!isValid) {
      throw new AppError(
        "Invalid webhook signature.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 2. Webhook Event Idempotency & Data Minimization: verify x-razorpay-event-id (Requirement 7 & 8)
    const eventType = eventData.event;
    const paymentEntity = eventData.payload?.payment?.entity;
    const gatewayOrderId = paymentEntity?.order_id || null;
    const gatewayPaymentId = paymentEntity?.id || null;

    if (eventId) {
      const existingEvent = await PaymentEvent.findOne({ eventId });
      if (existingEvent) {
        return { processed: false, reason: "Duplicate event ignored", eventId };
      }

      // Record event durably with minimal audit data (no raw body blobs)
      try {
        await PaymentEvent.create({
          eventId,
          eventType,
          gatewayOrderId,
          gatewayPaymentId,
          receivedAt: new Date(),
          processedAt: new Date(),
          processingStatus: "PROCESSED"
        });
      } catch (err) {
        if (err.code === 11000) {
          return { processed: false, reason: "Duplicate event ignored", eventId };
        }
        throw err;
      }
    }

    // 3. Handle events safely with valid state transitions
    if (!gatewayOrderId) {
      return { processed: true, note: "Non-order event acknowledged" };
    }

    const payment = await Payment.findOne({ gatewayOrderId });
    if (!payment) {
      return { processed: false, note: "Payment record not found for webhook order" };
    }

    const order = await Order.findById(payment.orderId);
    if (!order) {
      return { processed: false, note: "Order record not found" };
    }

    // 4. Safe state transitions and out-of-order handling (Requirement 5 & 6)
    if (eventType === "payment.captured" || eventType === "order.paid") {
      // Prevent duplicate processing if already captured
      if (payment.status === "CAPTURED" && order.orderStatus === "CONFIRMED") {
        return { processed: true, note: "Payment already captured and order confirmed" };
      }

      // CRITICAL REQUIREMENT 5: Webhook on Cancelled Order
      // If order is CANCELLED (e.g. cancelled by user or reservation expired),
      // preserve the financial fact without corrupting state or double-restoring stock!
      if (order.orderStatus === "CANCELLED") {
        await runInTransaction(async (session) => {
          payment.status = "CAPTURED";
          payment.gatewayPaymentId = gatewayPaymentId;
          payment.verificationStatus = "VERIFIED";
          payment.reconciliationStatus = "REFUND_REQUIRED";
          await payment.save(session ? { session } : {});

          order.paymentStatus = "REFUND_REQUIRED";
          order.statusHistory.push({
            status: "CANCELLED",
            changedAt: new Date(),
            note: `Payment captured via Webhook after order cancellation (Payment ID: ${gatewayPaymentId}). Reconciliation marked REFUND_REQUIRED.`
          });
          await order.save(session ? { session } : {});
        });

        return {
          processed: true,
          event: eventType,
          reconciliation: "REFUND_REQUIRED",
          note: "Payment captured on cancelled order. Refund required recorded."
        };
      }

      // If order is DELIVERED, do not regress state
      if (order.orderStatus === "DELIVERED") {
        payment.status = "CAPTURED";
        payment.gatewayPaymentId = gatewayPaymentId;
        payment.verificationStatus = "VERIFIED";
        await payment.save();
        return { processed: true, note: "Order is in terminal state 'DELIVERED'" };
      }

      // Normal PENDING order capture in short DB transaction
      await runInTransaction(async (session) => {
        payment.status = "CAPTURED";
        payment.gatewayPaymentId = gatewayPaymentId;
        payment.verificationStatus = "VERIFIED";
        await payment.save(session ? { session } : {});

        if (order.orderStatus === "PENDING") {
          order.orderStatus = "CONFIRMED";
          order.paymentStatus = "COMPLETED";
          order.statusHistory.push({
            status: "CONFIRMED",
            changedAt: new Date(),
            note: `Payment captured via Razorpay Webhook (Payment ID: ${gatewayPaymentId}).`
          });
          await order.save(session ? { session } : {});

          if (order.appliedCoupon && order.appliedCoupon.code) {
            await CouponService.recordCouponUsage({
              code: order.appliedCoupon.code,
              userId: order.userId,
              session
            });
          }
        }
      });
    } else if (eventType === "payment.failed") {
      // Transition Guard: If payment is already CAPTURED, late payment.failed MUST NOT corrupt financial truth!
      if (payment.status === "CAPTURED") {
        return {
          processed: true,
          note: "Invalid transition: Cannot transition CAPTURED payment to FAILED."
        };
      }

      if (order.orderStatus === "PENDING") {
        payment.status = "FAILED";
        payment.failureReason = paymentEntity?.error_description || "Payment failed via gateway";
        await payment.save();

        order.paymentStatus = "FAILED";
        await order.save();
      }
    }

    return { processed: true, event: eventType };
  }

  /**
   * Get payment details by Order ID
   */
  static async getPaymentByOrderId(orderId, userId, isAdmin = false) {
    const query = { orderId };
    if (!isAdmin) {
      query.userId = userId;
    }
    const payment = await Payment.findOne(query).sort({ createdAt: -1 });
    if (!payment) {
      throw new AppError("Payment record not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return payment;
  }

  /**
   * Get payment details by Payment ID
   */
  static async getPaymentById(paymentId, userId, isAdmin = false) {
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new AppError("Payment record not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    if (!isAdmin && payment.userId.toString() !== userId.toString()) {
      throw new AppError("Access denied.", HTTP_CODES.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }
    return payment;
  }
}

module.exports = PaymentService;
