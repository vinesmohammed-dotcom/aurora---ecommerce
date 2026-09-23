import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
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
import Refund from "../src/modules/refunds/refund.model";
import RefundService from "../src/modules/refunds/refund.service";
import Wallet from "../src/modules/wallet/wallet.model";
import WalletTransaction from "../src/modules/wallet/walletTransaction.model";

describe("Phase 7 — Razorpay Gateway Refunds & Return Architecture (Hardened Integration Tests)", () => {
  let userACookie;
  let userBCookie;
  let adminCookie;
  let userAId;
  let userBId;
  let adminId;
  let addressAId;
  let product1Id;
  let variant1Id;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite"
      );
    }

    await Refund.syncIndexes();
    await Payment.syncIndexes();
    await Order.syncIndexes();
    await Wallet.syncIndexes();
    await WalletTransaction.syncIndexes();

    await Refund.deleteMany({});
    await Payment.deleteMany({});
    await Order.deleteMany({});
    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await Cart.deleteMany({});
    await Address.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({
      email: { $in: ["user.refunda@example.com", "user.refundb@example.com", "admin.refund@example.com"] }
    });

    // 1. Seed Admin
    const adminPass = await User.hashPassword("AdminPass123!");
    const admin = await User.create({
      name: "Refund Admin",
      email: "admin.refund@example.com",
      passwordHash: adminPass,
      role: "ADMIN",
      isVerified: true
    });
    adminId = admin._id.toString();
    const adminRes = await request(app).post("/api/v1/auth/login").send({
      email: "admin.refund@example.com",
      password: "AdminPass123!"
    });
    adminCookie = adminRes.headers["set-cookie"][0];

    // 2. Seed Customer A
    const passA = await User.hashPassword("UserPass123!");
    const userA = await User.create({
      name: "Customer RefundA",
      email: "user.refunda@example.com",
      passwordHash: passA,
      role: "USER",
      isVerified: true
    });
    userAId = userA._id.toString();
    const userARes = await request(app).post("/api/v1/auth/login").send({
      email: "user.refunda@example.com",
      password: "UserPass123!"
    });
    userACookie = userARes.headers["set-cookie"][0];

    // 3. Seed Customer B
    const passB = await User.hashPassword("UserPass123!");
    const userB = await User.create({
      name: "Customer RefundB",
      email: "user.refundb@example.com",
      passwordHash: passB,
      role: "USER",
      isVerified: true
    });
    userBId = userB._id.toString();
    const userBRes = await request(app).post("/api/v1/auth/login").send({
      email: "user.refundb@example.com",
      password: "UserPass123!"
    });
    userBCookie = userBRes.headers["set-cookie"][0];

    // 4. Seed Address for User A
    const addrA = await Address.create({
      userId: userAId,
      fullName: "Refund Tester",
      phone: "9876543210",
      addressLine1: "123 Refund Blvd",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "India",
      isDefault: true
    });
    addressAId = addrA._id.toString();

    // 5. Seed Catalog Product
    const category = await Category.create({ name: "Audio", slug: "audio", isActive: true });
    const brand = await Brand.create({ name: "AcousticLab", slug: "acousticlab", isActive: true });
    const product = await Product.create({
      name: "Noise-Cancelling Headphones",
      slug: "nc-headphones",
      description: "Premium headphones",
      category: category._id,
      brand: brand._id,
      basePrice: 2000,
      isActive: true,
      variants: [
        {
          sku: "AUDIO-NC-BLK",
          name: "Black Edition",
          price: 2000,
          costPrice: 1200,
          stock: 50,
          isActive: true
        }
      ]
    });
    product1Id = product._id.toString();
    variant1Id = product.variants[0]._id.toString();
  });

  afterAll(async () => {
    await Refund.deleteMany({});
    await Payment.deleteMany({});
    await Order.deleteMany({});
    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await Cart.deleteMany({});
    await Address.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({
      email: { $in: ["user.refunda@example.com", "user.refundb@example.com", "admin.refund@example.com"] }
    });
  });

  // Helper to create a confirmed, captured online order with amount in paise
  const createCapturedOrder = async ({ userId = userAId, grandTotalRupees = 2000 } = {}) => {
    const amountPaise = grandTotalRupees * 100;
    const order = await Order.create({
      orderNumber: `ORD-REF-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      userId,
      shippingAddress: {
        fullName: "Refund Tester",
        phone: "9876543210",
        addressLine1: "123 Refund Blvd",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India"
      },
      items: [
        {
          productId: product1Id,
          variantId: variant1Id,
          sku: "AUDIO-NC-BLK",
          name: "Noise-Cancelling Headphones",
          slug: "nc-headphones",
          attributes: { Color: "Black" },
          unitPrice: grandTotalRupees,
          discountedUnitPrice: grandTotalRupees,
          quantity: 1,
          itemTotal: grandTotalRupees
        }
      ],
      priceSummary: {
        grossSubtotal: grandTotalRupees,
        offerDiscountTotal: 0,
        netSubtotal: grandTotalRupees,
        couponDiscount: 0,
        shippingFee: 0,
        grandTotal: grandTotalRupees
      },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "COMPLETED",
      orderStatus: "CONFIRMED",
      statusHistory: [
        { status: "CONFIRMED", changedAt: new Date(), note: "Payment captured" }
      ]
    });

    const payment = await Payment.create({
      orderId: order._id,
      userId,
      gateway: "RAZORPAY",
      gatewayOrderId: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      gatewayPaymentId: `pay_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      amount: amountPaise, // minor units (paise)
      currency: "INR",
      status: "CAPTURED",
      verificationStatus: "VERIFIED"
    });

    return { order, payment };
  };

  it("1. Money Units: should execute a full refund in integer paise without double conversion (₹2000 = 200000 paise)", async () => {
    const { order, payment } = await createCapturedOrder({ grandTotalRupees: 2000 });

    const res = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        amount: 200000, // 200000 paise
        reason: "Admin executed full refund in paise"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.refund.status).toBe("PROCESSED");
    expect(res.body.data.refund.amount).toBe(200000);
    expect(res.body.data.refund.refundType).toBe("FULL");
    expect(res.body.data.refund.gatewayRefundId).toMatch(/^rfnd_/);

    // Verify Payment updated to REFUNDED
    const updatedPayment = await Payment.findById(payment._id);
    expect(updatedPayment.status).toBe("REFUNDED");
    expect(updatedPayment.amount).toBe(200000);

    // Verify Order paymentStatus updated to REFUNDED
    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.paymentStatus).toBe("REFUNDED");
  });

  it("2. Money Unit Tests: proving ₹1000 = 100000 paise, partial 25000 paise, remaining 75000 paise", async () => {
    const { order, payment } = await createCapturedOrder({ grandTotalRupees: 1000 });
    expect(payment.amount).toBe(100000); // ₹1000 = 100000 paise

    // Partial refund: 25000 paise (₹250)
    const resPartial = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        amount: 25000,
        reason: "Partial refund of 25000 paise"
      });

    expect(resPartial.status).toBe(201);
    expect(resPartial.body.data.refund.amount).toBe(25000);
    expect(resPartial.body.data.refund.refundType).toBe("PARTIAL");

    // Check remaining refundable balance calculation
    const existingRefunds = await Refund.find({
      paymentId: payment._id,
      status: { $in: ["PENDING", "PROCESSING", "PROCESSED"] }
    });
    const totalRefundedPaise = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
    expect(totalRefundedPaise).toBe(25000);

    const remainingRefundablePaise = payment.amount - totalRefundedPaise;
    expect(remainingRefundablePaise).toBe(75000); // 100000 - 25000 = 75000 paise

    // Attempt refunding 80000 paise (exceeds 75000 paise) -> Must fail
    const resOver = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        amount: 80000,
        reason: "Excess refund attempt"
      });

    expect(resOver.status).toBe(400);
    expect(resOver.body.message).toMatch(/exceeds maximum refundable balance of ₹750\.00/i);

    // Refund exact remaining 75000 paise -> Completes full refund
    const resRemaining = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        amount: 75000,
        reason: "Final 75000 paise refund"
      });

    expect(resRemaining.status).toBe(201);
    expect(resRemaining.body.data.refund.amount).toBe(75000);
    expect(resRemaining.body.data.refund.refundType).toBe("FULL");

    const finalPayment = await Payment.findById(payment._id);
    expect(finalPayment.status).toBe("REFUNDED");
  });

  it("3. Admin Authorization: Regular USER must never be allowed to create refund (403 Forbidden)", async () => {
    const { order } = await createCapturedOrder({ grandTotalRupees: 1000 });

    const res = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", userACookie) // Customer cookie
      .send({
        orderId: order._id.toString(),
        amount: 100000,
        reason: "Unauthorized customer refund"
      });

    expect(res.status).toBe(403);
  });

  it("4. Refund Concurrency: Two simultaneous refund requests for ₹700 (70000 paise) on ₹1000 payment", async () => {
    const { order } = await createCapturedOrder({ grandTotalRupees: 1000 });

    // Both requests attempt to refund 70000 paise concurrently
    const [reqA, reqB] = await Promise.all([
      request(app)
        .post("/api/v1/refunds")
        .set("Cookie", adminCookie)
        .send({
          orderId: order._id.toString(),
          amount: 70000,
          reason: "Concurrent refund request A",
          idempotencyKey: `concurrent_test_a_${Date.now()}`
        }),
      request(app)
        .post("/api/v1/refunds")
        .set("Cookie", adminCookie)
        .send({
          orderId: order._id.toString(),
          amount: 70000,
          reason: "Concurrent refund request B",
          idempotencyKey: `concurrent_test_b_${Date.now()}`
        })
    ]);

    // Exactly one must succeed (201) and one must be rejected (400) because only 30000 remains refundable
    const statuses = [reqA.status, reqB.status].sort();
    expect(statuses).toEqual([201, 400]);

    const failedReq = reqA.status === 400 ? reqA : reqB;
    expect(failedReq.body.message).toMatch(/exceeds maximum refundable balance/i);

    // Assert total committed/processed refunds strictly never exceed captured payment (100000 paise)
    const refunds = await Refund.find({ orderId: order._id, status: { $in: ["PENDING", "PROCESSING", "PROCESSED"] } });
    const totalCommitted = refunds.reduce((sum, r) => sum + r.amount, 0);
    expect(totalCommitted).toBe(70000);
    expect(totalCommitted).toBeLessThanOrEqual(100000);
  });

  it("5. Refund Failure & Retry: Gateway failure leaves refund FAILED and reserved amount is released for retry", async () => {
    const { order, payment } = await createCapturedOrder({ grandTotalRupees: 1800 });

    process.env.FORCE_REFUND_GATEWAY_FAILURE = "true";

    try {
      const res = await request(app)
        .post("/api/v1/refunds")
        .set("Cookie", adminCookie)
        .send({
          orderId: order._id.toString(),
          amount: 180000,
          reason: "Gateway failure test"
        });

      expect(res.status).toBe(500);

      // Verify Refund record is marked FAILED
      const failedRefund = await Refund.findOne({ orderId: order._id });
      expect(failedRefund).toBeDefined();
      expect(failedRefund.status).toBe("FAILED");
      expect(failedRefund.failureReason).toMatch(/504 Gateway Timeout/i);

      // Payment and Order must remain CAPTURED and COMPLETED (not corrupted)
      const intactPayment = await Payment.findById(payment._id);
      expect(intactPayment.status).toBe("CAPTURED");

      const intactOrder = await Order.findById(order._id);
      expect(intactOrder.paymentStatus).toBe("COMPLETED");

      // Verify that no wallet transactions were created
      const walletTxCount = await WalletTransaction.countDocuments({ userId: order.userId });
      expect(walletTxCount).toBe(0);
    } finally {
      delete process.env.FORCE_REFUND_GATEWAY_FAILURE;
    }

    // Retrying the refund now succeeds because the FAILED amount is not counting against refundable capacity!
    const retryRes = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        amount: 180000,
        reason: "Retry after gateway failure"
      });

    expect(retryRes.status).toBe(201);
    expect(retryRes.body.data.refund.status).toBe("PROCESSED");

    const settledPayment = await Payment.findById(payment._id);
    expect(settledPayment.status).toBe("REFUNDED");
  });

  it("6. Idempotency: Duplicate refund submission with same idempotencyKey returns existing record", async () => {
    const { order } = await createCapturedOrder({ grandTotalRupees: 1500 });
    const key = `idem_key_refund_${Date.now()}`;

    const res1 = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        amount: 150000,
        reason: "Idempotent refund attempt",
        idempotencyKey: key
      });

    expect(res1.status).toBe(201);
    expect(res1.body.data.isDuplicate).toBe(false);

    // Duplicate submission
    const res2 = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        amount: 150000,
        reason: "Idempotent refund attempt",
        idempotencyKey: key
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data.isDuplicate).toBe(true);
    expect(res2.body.data.refund._id).toBe(res1.body.data.refund._id);

    const totalRefunds = await Refund.countDocuments({ orderId: order._id });
    expect(totalRefunds).toBe(1);
  });

  it("7. Return Lifecycle & Stock Timing: Approve -> Item Received -> Inspection Pass -> Stock Restored", async () => {
    const { order } = await createCapturedOrder({ grandTotalRupees: 2000 });

    // Transition to DELIVERED
    order.orderStatus = "DELIVERED";
    order.statusHistory.push({
      status: "DELIVERED",
      changedAt: new Date(),
      note: "Delivered to customer"
    });
    await order.save();

    // 1. Customer requests return
    await request(app)
      .post(`/api/v1/orders/${order._id.toString()}/return`)
      .set("Cookie", userACookie)
      .send({ reason: "Unboxing fit issue" });

    // Check stock BEFORE admin approval
    const prodBefore = await Product.findById(product1Id);
    const initialStock = prodBefore.variants[0].stock;

    // 2. Admin reviews and approves return
    const reviewRes = await request(app)
      .post(`/api/v1/admin/orders/${order._id.toString()}/return/review`)
      .set("Cookie", adminCookie)
      .send({ decision: "APPROVED" });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.order.orderStatus).toBe("RETURN_APPROVED");

    // CRITICAL: Stock must NOT be restored on return approval!
    const prodAfterApprove = await Product.findById(product1Id);
    expect(prodAfterApprove.variants[0].stock).toBe(initialStock);

    // 3. Admin marks item received at warehouse
    const receiveRes = await request(app)
      .post(`/api/v1/admin/orders/${order._id.toString()}/return/receive`)
      .set("Cookie", adminCookie);

    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.data.order.orderStatus).toBe("RETURN_RECEIVED");

    // Stock must STILL NOT be restored before inspection!
    const prodAfterReceive = await Product.findById(product1Id);
    expect(prodAfterReceive.variants[0].stock).toBe(initialStock);

    // 4. Quality Inspection passes and allows restock
    const inspectRes = await request(app)
      .post(`/api/v1/admin/orders/${order._id.toString()}/return/inspect`)
      .set("Cookie", adminCookie)
      .send({
        inspectionPassed: true,
        restock: true,
        notes: "Item sealed and factory intact"
      });

    expect(inspectRes.status).toBe(200);
    expect(inspectRes.body.data.order.orderStatus).toBe("RETURN_INSPECTED");

    // NOW stock is safely restored (+1)
    const prodAfterInspect = await Product.findById(product1Id);
    expect(prodAfterInspect.variants[0].stock).toBe(initialStock + 1);

    // 5. Attempting duplicate inspection must NOT double-restore stock
    await expect(
      OrderService.inspectReturnItem({
        orderId: order._id,
        adminId,
        inspectionPassed: true,
        restock: true,
        notes: "Duplicate attempt"
      })
    ).rejects.toThrow(/Only 'RETURN_RECEIVED' orders can be inspected/i);

    const prodAfterDup = await Product.findById(product1Id);
    expect(prodAfterDup.variants[0].stock).toBe(initialStock + 1);

    // 6. Admin creates gateway refund against captured payment -> order transitions to RETURNED
    const refundRes = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        reason: "Approved return refund"
      });

    expect(refundRes.status).toBe(201);
    expect(refundRes.body.data.order.orderStatus).toBe("RETURNED");
    expect(refundRes.body.data.order.paymentStatus).toBe("REFUNDED");
  });

  it("8. Return Inspection Rejection: Damaged return does NOT restore sellable inventory", async () => {
    const { order } = await createCapturedOrder({ grandTotalRupees: 2000 });

    order.orderStatus = "DELIVERED";
    await order.save();

    await request(app)
      .post(`/api/v1/orders/${order._id.toString()}/return`)
      .set("Cookie", userACookie)
      .send({ reason: "Sound distorted" });

    await request(app)
      .post(`/api/v1/admin/orders/${order._id.toString()}/return/review`)
      .set("Cookie", adminCookie)
      .send({ decision: "APPROVED" });

    await request(app)
      .post(`/api/v1/admin/orders/${order._id.toString()}/return/receive`)
      .set("Cookie", adminCookie);

    const prodBefore = await Product.findById(product1Id);
    const stockBefore = prodBefore.variants[0].stock;

    // Inspection fails: Item damaged by customer
    const inspectRes = await request(app)
      .post(`/api/v1/admin/orders/${order._id.toString()}/return/inspect`)
      .set("Cookie", adminCookie)
      .send({
        inspectionPassed: false,
        restock: false,
        notes: "Item cracked and water damaged"
      });

    expect(inspectRes.status).toBe(200);
    expect(inspectRes.body.data.order.orderStatus).toBe("RETURN_INSPECTED");
    expect(inspectRes.body.data.order.returnRequest.status).toBe("INSPECTED_FAILED");

    // Sellable stock MUST NOT be restored!
    const prodAfter = await Product.findById(product1Id);
    expect(prodAfter.variants[0].stock).toBe(stockBefore);
  });

  it("9. Reject refund on Cash on Delivery (COD) orders", async () => {
    const codOrder = await Order.create({
      orderNumber: `ORD-COD-${Date.now()}`,
      userId: userAId,
      shippingAddress: {
        fullName: "Refund Tester",
        phone: "9876543210",
        addressLine1: "123 Refund Blvd",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India"
      },
      items: [
        {
          productId: product1Id,
          variantId: variant1Id,
          sku: "AUDIO-NC-BLK",
          name: "Headphones",
          slug: "nc-headphones",
          unitPrice: 1000,
          discountedUnitPrice: 1000,
          quantity: 1,
          itemTotal: 1000
        }
      ],
      priceSummary: { grossSubtotal: 1000, offerDiscountTotal: 0, netSubtotal: 1000, couponDiscount: 0, shippingFee: 0, grandTotal: 1000 },
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "CONFIRMED"
    });

    const res = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: codOrder._id.toString(),
        amount: 100000,
        reason: "COD refund test"
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Cash on Delivery \(COD\) orders cannot be refunded/i);
  });

  it("10. Reject refund on uncaptured / pending payment", async () => {
    const order = await Order.create({
      orderNumber: `ORD-UNPAID-${Date.now()}`,
      userId: userAId,
      shippingAddress: {
        fullName: "Refund Tester",
        phone: "9876543210",
        addressLine1: "123 Refund Blvd",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India"
      },
      items: [
        {
          productId: product1Id,
          variantId: variant1Id,
          sku: "AUDIO-NC-BLK",
          name: "Headphones",
          slug: "nc-headphones",
          unitPrice: 1000,
          discountedUnitPrice: 1000,
          quantity: 1,
          itemTotal: 1000
        }
      ],
      priceSummary: { grossSubtotal: 1000, offerDiscountTotal: 0, netSubtotal: 1000, couponDiscount: 0, shippingFee: 0, grandTotal: 1000 },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "PENDING",
      orderStatus: "PENDING"
    });

    await Payment.create({
      orderId: order._id,
      userId: userAId,
      gateway: "RAZORPAY",
      gatewayOrderId: `order_unpaid_${Date.now()}`,
      amount: 100000,
      currency: "INR",
      status: "CREATED" // Uncaptured
    });

    const res = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        amount: 100000,
        reason: "Refund on unpaid order"
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Only captured online payments can be refunded/i);
  });

  it("11. Strict separation: Razorpay refund creates zero wallet transactions; wallet credit creates zero Razorpay refunds", async () => {
    const initialWalletTxCount = await WalletTransaction.countDocuments();
    const initialRefundCount = await Refund.countDocuments();

    // 1. Issue Razorpay refund
    const { order } = await createCapturedOrder({ grandTotalRupees: 1000 });
    const refundRes = await request(app)
      .post("/api/v1/refunds")
      .set("Cookie", adminCookie)
      .send({
        orderId: order._id.toString(),
        amount: 100000,
        reason: "Separation audit test"
      });

    expect(refundRes.status).toBe(201);

    // Razorpay refund must NOT create any WalletTransaction
    const finalWalletTxCount = await WalletTransaction.countDocuments();
    expect(finalWalletTxCount).toBe(initialWalletTxCount);

    // 2. Issue Wallet credit
    await request(app)
      .post(`/api/v1/admin/wallets/${userAId}/credit`)
      .set("Cookie", adminCookie)
      .send({
        amount: 50000, // 50000 paise
        reason: "Separation audit test"
      });

    // Wallet credit must NOT create any Refund records
    const finalRefundCount = await Refund.countDocuments();
    expect(finalRefundCount).toBe(initialRefundCount + 1); // Only the 1 refund created above
  });
});
