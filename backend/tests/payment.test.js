import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import crypto from "crypto";
import app from "../src/app";
import env from "../src/config/env";
import User from "../src/modules/users/user.model";
import Category from "../src/modules/categories/category.model";
import Brand from "../src/modules/brands/brand.model";
import Product from "../src/modules/products/product.model";
import Cart from "../src/modules/cart/cart.model";
import Address from "../src/modules/addresses/address.model";
import Order from "../src/modules/orders/order.model";
import OrderService from "../src/modules/orders/order.service";
import Payment from "../src/modules/payments/payment.model";
import PaymentEvent from "../src/modules/payments/paymentEvent.model";
import PaymentService from "../src/modules/payments/payment.service";
import RazorpayService from "../src/services/razorpay.service";

describe("Phase 6 — Online Payments (Razorpay), Signatures, Webhooks & Retry (Integration Tests)", () => {
  let userACookie;
  let userBCookie;
  let userAId;
  let userBId;
  let addressAId;
  let product1Id;
  let variant1Id;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite"
      );
    }

    await Payment.syncIndexes();
    await PaymentEvent.syncIndexes();
    await Order.syncIndexes();

    await Payment.deleteMany({});
    await PaymentEvent.deleteMany({});
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await Address.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({
      email: { $in: ["user.paya@example.com", "user.payb@example.com"] }
    });

    // 1. Seed Customer A
    const passA = await User.hashPassword("PayPass123!");
    const userA = await User.create({
      name: "Customer PayA",
      email: "user.paya@example.com",
      passwordHash: passA,
      role: "USER",
      isVerified: true
    });
    userAId = userA._id.toString();

    const authResA = await request(app).post("/api/v1/auth/login").send({
      email: "user.paya@example.com",
      password: "PayPass123!"
    });
    userACookie = authResA.headers["set-cookie"][0];

    // 2. Seed Customer B
    const passB = await User.hashPassword("PayPass123!");
    const userB = await User.create({
      name: "Customer PayB",
      email: "user.payb@example.com",
      passwordHash: passB,
      role: "USER",
      isVerified: true
    });
    userBId = userB._id.toString();

    const authResB = await request(app).post("/api/v1/auth/login").send({
      email: "user.payb@example.com",
      password: "PayPass123!"
    });
    userBCookie = authResB.headers["set-cookie"][0];

    // 3. Seed Address
    const address = await Address.create({
      userId: userAId,
      fullName: "Customer PayA",
      phone: "9876543210",
      addressLine1: "42 Financial Way",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "India",
      isDefault: true
    });
    addressAId = address._id.toString();

    // 4. Seed Category & Brand & Product
    const category = await Category.create({ name: "Audio", slug: "audio", isActive: true });
    const brand = await Brand.create({ name: "Sony", slug: "sony", isActive: true });

    const product = await Product.create({
      name: "Wireless ANC Headphones",
      slug: "wireless-anc-headphones",
      description: "Premium active noise cancellation headphones",
      category: category._id,
      brand: brand._id,
      basePrice: 5000,
      isActive: true,
      variants: [
        {
          sku: "SONY-WH-BLK",
          name: "Black Edition",
          price: 5000,
          costPrice: 3000,
          stock: 10,
          isActive: true
        }
      ]
    });
    product1Id = product._id.toString();
    variant1Id = product.variants[0]._id.toString();
  });

  afterAll(async () => {
    await Payment.deleteMany({});
    await PaymentEvent.deleteMany({});
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await Address.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({
      email: { $in: ["user.paya@example.com", "user.payb@example.com"] }
    });
  });

  describe("Payment Order Creation (/api/v1/payments/create)", () => {
    it("Calculates server-authoritative amount, reserves stock upfront, and returns safe checkout info", async () => {
      // 1. Populate cart with 1 unit of headphones (₹5,000 retail price)
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const stockBefore = await Product.findById(product1Id);
      expect(stockBefore.variants.id(variant1Id).stock).toBe(10);

      // 2. Initiate Online Payment
      const res = await request(app)
        .post("/api/v1/payments/create")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const { checkoutInfo } = res.body.data;
      expect(checkoutInfo.orderId).toBeDefined();
      expect(checkoutInfo.razorpayOrderId).toBeDefined();
      expect(checkoutInfo.razorpayOrderId).toMatch(/^order_[A-Za-z0-9]+$/);
      // Verify Razorpay Order ID format: starts with order_ followed strictly by alphanumeric characters (no secondary underscore)
      expect(checkoutInfo.razorpayOrderId.slice(6)).not.toContain("_");

      // Verify the internal Payment document has the exact matching gateway order ID
      const paymentDoc = await Payment.findOne({ orderId: checkoutInfo.orderId });
      expect(paymentDoc.gatewayOrderId).toBe(checkoutInfo.razorpayOrderId);

      expect(checkoutInfo.amount).toBe(500000); // ₹5,000 * 100 paise = 500,000 paise (free shipping >= ₹1,000)
      expect(checkoutInfo.currency).toBe("INR");
      expect(checkoutInfo.keyId).toBe(env.RAZORPAY_KEY_ID);

      // CRITICAL SECURITY ASSERTION: Secret key is NEVER leaked in response
      expect(JSON.stringify(res.body)).not.toContain(env.RAZORPAY_KEY_SECRET);

      // Stock was decremented upfront from 10 to 9 to prevent overselling
      const stockAfter = await Product.findById(product1Id);
      expect(stockAfter.variants.id(variant1Id).stock).toBe(9);

      // Order created with PENDING status
      const order = await Order.findById(checkoutInfo.orderId);
      expect(order.orderStatus).toBe("PENDING");
      expect(order.paymentStatus).toBe("PENDING");
      expect(order.paymentMethod).toBe("ONLINE_RAZORPAY");

      // Cart was cleared
      const cart = await Cart.findOne({ userId: userAId });
      expect(cart.items.length).toBe(0);
    });

    it("Handles provider order-creation failure gracefully: restores reserved stock, cancels internal order, and returns sanitized error without generating mock order ID", async () => {
      // 1. Populate cart
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const stockBefore = await Product.findById(product1Id);
      const stockBaseline = stockBefore.variants.id(variant1Id).stock;

      // Mock PaymentService.razorpayService.createOrder to simulate a provider error (e.g. invalid credentials or network rejection)
      const createOrderSpy = vi.spyOn(PaymentService.razorpayService, "createOrder").mockRejectedValueOnce(
        new Error("Razorpay API 400 Bad Request: Simulated provider failure")
      );

      try {
        const res = await request(app)
          .post("/api/v1/payments/create")
          .set("Cookie", userACookie)
          .send({ addressId: addressAId });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("Failed to initialize payment gateway");
        // Verify no checkoutInfo with a fake order ID was returned
        expect(res.body.data).toBeUndefined();

        // Stock was restored by compensation rollback
        const stockAfter = await Product.findById(product1Id);
        expect(stockAfter.variants.id(variant1Id).stock).toBe(stockBaseline);

        // Associated order was cancelled
        const cancelledOrder = await Order.findOne({ userId: userAId }).sort({ createdAt: -1 });
        expect(cancelledOrder.orderStatus).toBe("CANCELLED");
        expect(cancelledOrder.paymentStatus).toBe("FAILED");
      } finally {
        createOrderSpy.mockRestore();
      }
    });
  });

  describe("Server-Side Cryptographic Signature Verification (/api/v1/payments/verify)", () => {
    let createdOrderId;
    let createdPaymentId;
    let razorpayOrderId;

    beforeAll(async () => {
      // Re-populate cart and create payment order
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const res = await request(app)
        .post("/api/v1/payments/create")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      createdOrderId = res.body.data.checkoutInfo.orderId;
      createdPaymentId = res.body.data.checkoutInfo.paymentId;
      razorpayOrderId = res.body.data.checkoutInfo.razorpayOrderId;
    });

    it("Rejects tampered or invalid signature (400 Bad Request)", async () => {
      const res = await request(app)
        .post("/api/v1/payments/verify")
        .set("Cookie", userACookie)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: "pay_tampered_123",
          razorpay_signature: "tampered_fake_signature_hex_12345"
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("invalid signature");

      // Order remains PENDING
      const order = await Order.findById(createdOrderId);
      expect(order.paymentStatus).toBe("FAILED");
      expect(order.orderStatus).toBe("PENDING");
    });

    it("Rejects signature verification attempt by unauthorized user (Anti-IDOR 403 Forbidden)", async () => {
      const fakePaymentId = "pay_valid_12345";
      const payload = `${razorpayOrderId}|${fakePaymentId}`;
      const validSig = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(payload).digest("hex");

      const res = await request(app)
        .post("/api/v1/payments/verify")
        .set("Cookie", userBCookie) // User B trying to verify User A's payment!
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: fakePaymentId,
          razorpay_signature: validSig
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("Successfully verifies authentic HMAC signature, confirms order, and does NOT double-decrement stock", async () => {
      const validPaymentId = "pay_live_" + Date.now();
      const payload = `${razorpayOrderId}|${validPaymentId}`;
      const validSig = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(payload).digest("hex");

      const stockBefore = await Product.findById(product1Id);
      const stockQtyBefore = stockBefore.variants.id(variant1Id).stock;

      const res = await request(app)
        .post("/api/v1/payments/verify")
        .set("Cookie", userACookie)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: validPaymentId,
          razorpay_signature: validSig
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { order, payment } = res.body.data;
      expect(order.orderStatus).toBe("CONFIRMED");
      expect(order.paymentStatus).toBe("COMPLETED");
      expect(payment.status).toBe("CAPTURED");
      expect(payment.gatewayPaymentId).toBe(validPaymentId);
      expect(payment.verificationStatus).toBe("VERIFIED");

      // CRITICAL ASSERTION: Stock was reserved at creation and is NOT decremented again!
      const stockAfter = await Product.findById(product1Id);
      expect(stockAfter.variants.id(variant1Id).stock).toBe(stockQtyBefore);
    });

    it("Idempotent Verification: Resubmitting identical payment verification returns existing state without side effects", async () => {
      const payment = await Payment.findById(createdPaymentId);
      const payload = `${razorpayOrderId}|${payment.gatewayPaymentId}`;
      const validSig = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(payload).digest("hex");

      const res = await request(app)
        .post("/api/v1/payments/verify")
        .set("Cookie", userACookie)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: payment.gatewayPaymentId,
          razorpay_signature: validSig
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isDuplicate).toBe(true);
      expect(res.body.data.order.orderStatus).toBe("CONFIRMED");
    });
  });

  describe("Payment Retry Engine (/api/v1/payments/retry)", () => {
    let failedOrderId;

    beforeAll(async () => {
      // Create an order that fails payment
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const res = await request(app)
        .post("/api/v1/payments/create")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      failedOrderId = res.body.data.checkoutInfo.orderId;

      // Simulate failed verification
      await request(app)
        .post("/api/v1/payments/verify")
        .set("Cookie", userACookie)
        .send({
          razorpay_order_id: res.body.data.checkoutInfo.razorpayOrderId,
          razorpay_payment_id: "pay_failed_1",
          razorpay_signature: "bad_signature"
        });
    });

    it("Allows retrying payment on an unpaid/failed order without rebuilding cart", async () => {
      const res = await request(app)
        .post("/api/v1/payments/retry")
        .set("Cookie", userACookie)
        .send({ orderId: failedOrderId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { checkoutInfo } = res.body.data;
      expect(checkoutInfo.orderId).toBe(failedOrderId);
      expect(checkoutInfo.razorpayOrderId).toBeDefined();
      expect(checkoutInfo.amount).toBe(500000);
    });

    it("Rejects payment retry for an already CONFIRMED / COMPLETED order", async () => {
      // Find confirmed order from earlier test
      const confirmedOrder = await Order.findOne({
        userId: userAId,
        orderStatus: "CONFIRMED",
        paymentStatus: "COMPLETED"
      });

      const res = await request(app)
        .post("/api/v1/payments/retry")
        .set("Cookie", userACookie)
        .send({ orderId: confirmedOrder._id });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Cannot retry payment");
    });
  });

  describe("Razorpay Webhook Handling & Raw Buffer Signature Verification (/api/v1/payments/webhook)", () => {
    let webhookOrderId;
    let webhookGatewayOrderId;

    beforeAll(async () => {
      // Create an order awaiting webhook
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const res = await request(app)
        .post("/api/v1/payments/create")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      webhookOrderId = res.body.data.checkoutInfo.orderId;
      webhookGatewayOrderId = res.body.data.checkoutInfo.razorpayOrderId;
    });

    it("Rejects webhook with invalid signature (400 Bad Request)", async () => {
      const rawPayload = JSON.stringify({ event: "payment.captured" });

      const res = await request(app)
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", "invalid_webhook_signature")
        .send(rawPayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid webhook signature");
    });

    it("Processes authentic payment.captured webhook using raw request body HMAC signature", async () => {
      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_wh_" + Date.now(),
              order_id: webhookGatewayOrderId,
              amount: 500000,
              currency: "INR",
              status: "captured"
            }
          }
        }
      };

      const rawBuffer = Buffer.from(JSON.stringify(eventPayload), "utf-8");
      const validSignature = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBuffer)
        .digest("hex");

      const eventId = "evt_" + Date.now();

      const res = await request(app)
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", validSignature)
        .set("X-Razorpay-Event-Id", eventId)
        .send(eventPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");

      // Verify Order transitioned to CONFIRMED & COMPLETED
      const order = await Order.findById(webhookOrderId);
      expect(order.orderStatus).toBe("CONFIRMED");
      expect(order.paymentStatus).toBe("COMPLETED");

      // Verify Payment transitioned to CAPTURED
      const payment = await Payment.findOne({ gatewayOrderId: webhookGatewayOrderId });
      expect(payment.status).toBe("CAPTURED");
      expect(payment.verificationStatus).toBe("VERIFIED");
    });

    it("Webhook Idempotency: Duplicate delivery of identical event ID is safely acknowledged without duplicate state changes", async () => {
      const eventId = "evt_duplicate_test_" + Date.now();
      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_wh_dup_123",
              order_id: webhookGatewayOrderId,
              amount: 500000
            }
          }
        }
      };

      const rawBuffer = Buffer.from(JSON.stringify(eventPayload), "utf-8");
      const validSignature = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBuffer)
        .digest("hex");

      // First webhook delivery
      const res1 = await request(app)
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", validSignature)
        .set("X-Razorpay-Event-Id", eventId)
        .send(eventPayload);

      expect(res1.status).toBe(200);

      // Second webhook delivery with SAME event ID
      const res2 = await request(app)
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", validSignature)
        .set("X-Razorpay-Event-Id", eventId)
        .send(eventPayload);

      expect(res2.status).toBe(200);
      expect(res2.body.reason).toContain("Duplicate event ignored");

      // Exactly 1 event recorded in DB
      const count = await PaymentEvent.countDocuments({ eventId });
      expect(count).toBe(1);
    });

    it("Out-of-order protection: payment.captured webhook does NOT revert an already CANCELLED order", async () => {
      // Cancel the order first
      await Order.updateOne({ _id: webhookOrderId }, { $set: { orderStatus: "CANCELLED" } });

      const newEventId = "evt_out_of_order_" + Date.now();
      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_late_arrival",
              order_id: webhookGatewayOrderId,
              amount: 500000
            }
          }
        }
      };

      const rawBuffer = Buffer.from(JSON.stringify(eventPayload), "utf-8");
      const validSignature = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBuffer)
        .digest("hex");

      const res = await request(app)
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", validSignature)
        .set("X-Razorpay-Event-Id", newEventId)
        .send(eventPayload);

      // Order status MUST REMAIN CANCELLED (never reverted back to CONFIRMED!)
      const order = await Order.findById(webhookOrderId);
      expect(order.orderStatus).toBe("CANCELLED");
      expect(order.paymentStatus).toBe("REFUND_REQUIRED");

      const payment = await Payment.findOne({ gatewayOrderId: webhookGatewayOrderId });
      expect(payment.status).toBe("CAPTURED");
      expect(payment.reconciliationStatus).toBe("REFUND_REQUIRED");
    });
  });

  describe("Hardening: Financial Reconciliation — Success After Cancellation (Requirements 5 & 11)", () => {
    it("Preserves financial truth: Payment becomes CAPTURED, Order remains CANCELLED, reconciliation is REFUND_REQUIRED, and NO duplicate stock restoration occurs", async () => {
      // 1. Order created & stock reserved
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 2 });

      const stockBeforeCreation = await Product.findById(product1Id);
      const initialStock = stockBeforeCreation.variants.id(variant1Id).stock;

      const createRes = await request(app)
        .post("/api/v1/payments/create")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      expect(createRes.status).toBe(201);
      const { orderId, razorpayOrderId } = createRes.body.data.checkoutInfo;

      const stockAfterCreation = await Product.findById(product1Id);
      expect(stockAfterCreation.variants.id(variant1Id).stock).toBe(initialStock - 2);

      // 2. Order cancelled by user/admin (stock restored once)
      const cancelRes = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set("Cookie", userACookie)
        .send({ reason: "Customer changed mind before payment completed" });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.order.orderStatus).toBe("CANCELLED");

      const stockAfterCancellation = await Product.findById(product1Id);
      expect(stockAfterCancellation.variants.id(variant1Id).stock).toBe(initialStock);

      // 3. Late captured-payment webhook arrives
      const lateEventId = "evt_recon_" + Date.now();
      const latePaymentId = "pay_recon_" + Date.now();
      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: latePaymentId,
              order_id: razorpayOrderId,
              amount: 1000000,
              currency: "INR",
              status: "captured"
            }
          }
        }
      };

      const rawBuffer = Buffer.from(JSON.stringify(eventPayload), "utf-8");
      const validSignature = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBuffer)
        .digest("hex");

      const whRes = await request(app)
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", validSignature)
        .set("X-Razorpay-Event-Id", lateEventId)
        .send(eventPayload);

      expect(whRes.status).toBe(200);
      expect(whRes.body.reconciliation).toBe("REFUND_REQUIRED");

      // 4. Verify Internal payment becomes CAPTURED
      const paymentDoc = await Payment.findOne({ gatewayOrderId: razorpayOrderId });
      expect(paymentDoc.status).toBe("CAPTURED");
      expect(paymentDoc.verificationStatus).toBe("VERIFIED");

      // 5. Verify Order remains CANCELLED
      const orderDoc = await Order.findById(orderId);
      expect(orderDoc.orderStatus).toBe("CANCELLED");

      // 6. System records that a refund is required
      expect(paymentDoc.reconciliationStatus).toBe("REFUND_REQUIRED");
      expect(orderDoc.paymentStatus).toBe("REFUND_REQUIRED");

      // 7. Critical: No duplicate stock restoration occurs!
      const finalStock = await Product.findById(product1Id);
      expect(finalStock.variants.id(variant1Id).stock).toBe(initialStock);
    });
  });

  describe("Hardening: Payment Stock Reservation Expiration & Idempotent Cleanup (Requirements 1, 2, 9, 10, 12)", () => {
    it("Payment failure keeps stock reserved until retry or expiration", async () => {
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const stockBefore = await Product.findById(product1Id);
      const baseStock = stockBefore.variants.id(variant1Id).stock;

      const createRes = await request(app)
        .post("/api/v1/payments/create")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      const { orderId, razorpayOrderId } = createRes.body.data.checkoutInfo;

      // Stock is decremented by 1
      const stockAfterCreate = await Product.findById(product1Id);
      expect(stockAfterCreate.variants.id(variant1Id).stock).toBe(baseStock - 1);

      // Simulate failed verification attempt
      await request(app)
        .post("/api/v1/payments/verify")
        .set("Cookie", userACookie)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: "pay_failed_sig",
          razorpay_signature: "bad_signature"
        });

      // Assert stock remains reserved (not restored yet, customer can retry)
      const stockAfterFail = await Product.findById(product1Id);
      expect(stockAfterFail.variants.id(variant1Id).stock).toBe(baseStock - 1);

      const order = await Order.findById(orderId);
      expect(order.orderStatus).toBe("PENDING");
      expect(order.paymentStatus).toBe("FAILED");
    });

    it("Releases stock exactly once when payment reservation expires, and duplicate cleanup does not restore stock twice", async () => {
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 2 });

      const stockBefore = await Product.findById(product1Id);
      const stockBeforeReservation = stockBefore.variants.id(variant1Id).stock;

      const createRes = await request(app)
        .post("/api/v1/payments/create")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      const { orderId } = createRes.body.data.checkoutInfo;

      const stockWhileReserved = await Product.findById(product1Id);
      expect(stockWhileReserved.variants.id(variant1Id).stock).toBe(stockBeforeReservation - 2);

      // Simulate TTL expiration: set paymentExpiresAt to 20 minutes ago
      await Order.updateOne(
        { _id: orderId },
        { $set: { paymentExpiresAt: new Date(Date.now() - 20 * 60 * 1000) } }
      );

      // 1. First Cleanup Run: Should identify expired order and safely release inventory exactly once
      const cleanupRun1 = await OrderService.cleanupExpiredReservations();
      expect(cleanupRun1.cleanedCount).toBeGreaterThanOrEqual(1);
      expect(cleanupRun1.orderIds).toContain(orderId);

      const stockAfterCleanup1 = await Product.findById(product1Id);
      expect(stockAfterCleanup1.variants.id(variant1Id).stock).toBe(stockBeforeReservation);

      const expiredOrder = await Order.findById(orderId);
      expect(expiredOrder.orderStatus).toBe("CANCELLED");
      expect(expiredOrder.paymentStatus).toBe("EXPIRED");
      expect(expiredOrder.cancellationReason).toBe("Payment reservation expired");

      // 2. Second Cleanup Run (Idempotency Assertion): Stock must NOT be incremented again!
      const cleanupRun2 = await OrderService.cleanupExpiredReservations();
      expect(cleanupRun2.orderIds).not.toContain(orderId);

      const stockAfterCleanup2 = await Product.findById(product1Id);
      expect(stockAfterCleanup2.variants.id(variant1Id).stock).toBe(stockBeforeReservation);
    });

    it("Rejects payment retry using an expired reservation and instructs user to create a new order", async () => {
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const createRes = await request(app)
        .post("/api/v1/payments/create")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      const { orderId } = createRes.body.data.checkoutInfo;

      // Set reservation expired
      await Order.updateOne(
        { _id: orderId },
        { $set: { paymentExpiresAt: new Date(Date.now() - 1000) } }
      );

      // Attempt retry
      const retryRes = await request(app)
        .post("/api/v1/payments/retry")
        .set("Cookie", userACookie)
        .send({ orderId });

      expect(retryRes.status).toBe(400);
      expect(retryRes.body.message).toContain("Payment reservation has expired");

      // Order is transitioned to CANCELLED / EXPIRED
      const order = await Order.findById(orderId);
      expect(order.orderStatus).toBe("CANCELLED");
      expect(order.paymentStatus).toBe("EXPIRED");
    });
  });

  describe("Hardening: Payment Creation Failure & Compensation Rollback (Requirement 13 & 14)", () => {
    it("Compensates immediately if external gateway order creation throws: restores stock and cancels order", async () => {
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const stockBefore = await Product.findById(product1Id);
      const stockBaseline = stockBefore.variants.id(variant1Id).stock;

      // Temporarily mock Payment.create to throw an error (simulating network / gateway failure)
      const spy = vi
        .spyOn(Payment, "create")
        .mockRejectedValueOnce(new Error("Razorpay API 502 Bad Gateway"));

      try {
        const res = await request(app)
          .post("/api/v1/payments/create")
          .set("Cookie", userACookie)
          .send({ addressId: addressAId });

        expect(res.status).toBe(500);
        expect(res.body.message).toContain("Failed to initialize payment gateway");

        // Assert stock was NOT permanently locked: restored immediately!
        const stockAfterCompensation = await Product.findById(product1Id);
        expect(stockAfterCompensation.variants.id(variant1Id).stock).toBe(stockBaseline);

        // Find the cancelled order
        const order = await Order.findOne({ userId: userAId }).sort({ createdAt: -1 });
        expect(order.orderStatus).toBe("CANCELLED");
        expect(order.paymentStatus).toBe("FAILED");
        expect(order.cancellationReason).toContain("Gateway initialization failed");
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("Hardening: Asymmetric Webhook and Callback Arrival Order (Requirement 12)", () => {
    it("Webhook before callback: webhook captures payment, subsequent callback handles it idempotently without double-decrementing stock", async () => {
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const stockBefore = await Product.findById(product1Id);
      const stockBaseline = stockBefore.variants.id(variant1Id).stock;

      const createRes = await request(app)
        .post("/api/v1/payments/create")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      const { orderId, razorpayOrderId } = createRes.body.data.checkoutInfo;
      const expectedStock = stockBaseline - 1;

      // 1. Webhook arrives FIRST
      const paymentId = "pay_before_cb_" + Date.now();
      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: razorpayOrderId,
              amount: 500000,
              currency: "INR",
              status: "captured"
            }
          }
        }
      };

      const rawBuffer = Buffer.from(JSON.stringify(eventPayload), "utf-8");
      const validSig = crypto
        .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBuffer)
        .digest("hex");

      const whRes = await request(app)
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", validSig)
        .set("X-Razorpay-Event-Id", "evt_early_" + Date.now())
        .send(eventPayload);

      expect(whRes.status).toBe(200);

      const orderAfterWh = await Order.findById(orderId);
      expect(orderAfterWh.orderStatus).toBe("CONFIRMED");
      expect(orderAfterWh.paymentStatus).toBe("COMPLETED");

      const stockAfterWh = await Product.findById(product1Id);
      expect(stockAfterWh.variants.id(variant1Id).stock).toBe(expectedStock);

      // 2. Client Callback arrives LATER with client signature
      const clientPayload = `${razorpayOrderId}|${paymentId}`;
      const clientSig = crypto
        .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
        .update(clientPayload)
        .digest("hex");

      const cbRes = await request(app)
        .post("/api/v1/payments/verify")
        .set("Cookie", userACookie)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: clientSig
        });

      expect(cbRes.status).toBe(200);
      expect(cbRes.body.data.isDuplicate).toBe(true);

      // Stock is invariant: does NOT decrement again!
      const stockAfterCb = await Product.findById(product1Id);
      expect(stockAfterCb.variants.id(variant1Id).stock).toBe(expectedStock);
    });
  });
});

