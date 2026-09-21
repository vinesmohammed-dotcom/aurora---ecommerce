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

describe("Phase 5 — Orders, COD Checkout, State Machine & Idempotency (Integration Tests)", () => {
  let userACookie;
  let userBCookie;
  let adminCookie;
  let userAId;
  let userBId;
  let addressAId;
  let product1Id;
  let variant1Id;
  let product2Id;
  let variant2Id;
  let placedOrderId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    await Order.syncIndexes();
    await Cart.syncIndexes();
    await Address.syncIndexes();

    await Order.deleteMany({});
    await Cart.deleteMany({});
    await Address.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({
      email: { $in: ["user.ordera@example.com", "user.orderb@example.com", "admin.order@example.com"] }
    });

    // Seed Admin
    const adminPass = await User.hashPassword("AdminPass123!");
    await User.create({
      name: "Order Admin",
      email: "admin.order@example.com",
      passwordHash: adminPass,
      role: "ADMIN",
      isVerified: true
    });
    const adminAuthRes = await request(app).post("/api/v1/auth/login").send({
      email: "admin.order@example.com",
      password: "AdminPass123!"
    });
    adminCookie = adminAuthRes.headers["set-cookie"][0];

    // Seed User A
    const userAPass = await User.hashPassword("UserAPass123!");
    const userA = await User.create({
      name: "Customer A",
      email: "user.ordera@example.com",
      passwordHash: userAPass,
      role: "USER",
      isVerified: true
    });
    userAId = userA._id.toString();
    const userAAuthRes = await request(app).post("/api/v1/auth/login").send({
      email: "user.ordera@example.com",
      password: "UserAPass123!"
    });
    userACookie = userAAuthRes.headers["set-cookie"][0];

    // Seed User B
    const userBPass = await User.hashPassword("UserBPass123!");
    const userB = await User.create({
      name: "Customer B",
      email: "user.orderb@example.com",
      passwordHash: userBPass,
      role: "USER",
      isVerified: true
    });
    userBId = userB._id.toString();
    const userBAuthRes = await request(app).post("/api/v1/auth/login").send({
      email: "user.orderb@example.com",
      password: "UserBPass123!"
    });
    userBCookie = userBAuthRes.headers["set-cookie"][0];

    // Address for User A
    const addr = await Address.create({
      userId: userAId,
      fullName: "Customer A Recipient",
      phone: "+91 9123456780",
      addressLine1: "100 Innovation Drive",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "India",
      isDefault: true
    });
    addressAId = addr._id.toString();

    // Seed Products
    const cat = await Category.create({ name: "Footwear", slug: "footwear", isActive: true });
    const brand = await Brand.create({ name: "Nike", slug: "nike", isActive: true });

    // Product 1: stock = 10
    const p1 = await Product.create({
      name: "Air Zoom Pegasus",
      slug: "air-zoom-pegasus",
      description: "Iconic responsive road running shoes.",
      category: cat._id,
      brand: brand._id,
      isActive: true,
      variants: [{ sku: "PEG-01", price: 12000, costPrice: 7000, stock: 10, isActive: true }]
    });
    product1Id = p1._id.toString();
    variant1Id = p1.variants[0]._id.toString();

    // Product 2: stock = 0 (for rollback tests)
    const p2 = await Product.create({
      name: "Rare Edition Trainer",
      slug: "rare-edition-trainer",
      description: "Extremely limited edition trainer.",
      category: cat._id,
      brand: brand._id,
      isActive: true,
      variants: [{ sku: "RARE-01", price: 18000, costPrice: 10000, stock: 0, isActive: true }]
    });
    product2Id = p2._id.toString();
    variant2Id = p2.variants[0]._id.toString();
  });

  afterAll(async () => {
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await Address.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({
      email: { $in: ["user.ordera@example.com", "user.orderb@example.com", "admin.order@example.com"] }
    });
  });

  describe("COD Order Placement & Snapshot Integrity", () => {
    it("Successfully places COD order with immutable snapshots and clears cart", async () => {
      // Add Product 1 to User A cart (2 units)
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 2 });

      const res = await request(app)
        .post("/api/v1/orders/checkout/cod")
        .set("Cookie", userACookie)
        .send({
          addressId: addressAId,
          idempotencyKey: "test-key-order-12345"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const order = res.body.data.order;
      placedOrderId = order._id;

      // Verify immutable snapshots
      expect(order.orderNumber).toMatch(/^ORD-/);
      expect(order.shippingAddress.fullName).toBe("Customer A Recipient");
      expect(order.items.length).toBe(1);
      expect(order.items[0].name).toBe("Air Zoom Pegasus");
      expect(order.items[0].quantity).toBe(2);
      expect(order.items[0].unitPrice).toBe(12000);
      expect(order.paymentMethod).toBe("COD");
      expect(order.paymentStatus).toBe("PENDING");
      expect(order.orderStatus).toBe("CONFIRMED");

      // Verify stock was decremented from 10 to 8
      const prod = await Product.findById(product1Id);
      expect(prod.variants.id(variant1Id).stock).toBe(8);

      // Verify cart was cleared
      const cartRes = await request(app).get("/api/v1/cart").set("Cookie", userACookie);
      expect(cartRes.body.data.cart.items.length).toBe(0);
    });

    it("Idempotency: Resubmitting identical idempotencyKey returns existing order without re-decrementing stock", async () => {
      const res = await request(app)
        .post("/api/v1/orders/checkout/cod")
        .set("Cookie", userACookie)
        .send({
          addressId: addressAId,
          idempotencyKey: "test-key-order-12345"
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.data.order._id).toBe(placedOrderId);

      // Stock remains 8 (NOT decremented again)
      const prod = await Product.findById(product1Id);
      expect(prod.variants.id(variant1Id).stock).toBe(8);
    });
  });

  describe("Multi-Item Atomic Stock Rollback", () => {
    it("Rolls back stock on all prior items if any item in cart fails stock check during order placement", async () => {
      // Stock of variant1 is 8. Stock of variant2 is 0.
      // Force an item into cart directly for test
      await Cart.updateOne(
        { userId: userAId },
        {
          $set: {
            items: [
              { productId: product1Id, variantId: variant1Id, quantity: 1 },
              { productId: product2Id, variantId: variant2Id, quantity: 1 } // Out of stock!
            ]
          }
        },
        { upsert: true }
      );

      const res = await request(app)
        .post("/api/v1/orders/checkout/cod")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Insufficient stock");

      // Verify variant1 stock was NOT depleted (remains 8 due to compensation rollback!)
      const prod1 = await Product.findById(product1Id);
      expect(prod1.variants.id(variant1Id).stock).toBe(8);
    });
  });

  describe("Anti-IDOR Security", () => {
    it("CRITICAL: User B cannot view User A's order by ID (404 Not Found)", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${placedOrderId}`)
        .set("Cookie", userBCookie);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("CRITICAL: User B cannot cancel User A's order (404 Not Found)", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${placedOrderId}/cancel`)
        .set("Cookie", userBCookie)
        .send({ reason: "Hacker trying to cancel" });

      expect(res.status).toBe(404);
    });
  });

  describe("Order Cancellation & Idempotent Stock Restoration", () => {
    it("Customer can cancel CONFIRMED order and restore inventory atomically", async () => {
      // Stock before cancellation is 8
      const beforeProd = await Product.findById(product1Id);
      expect(beforeProd.variants.id(variant1Id).stock).toBe(8);

      const res = await request(app)
        .post(`/api/v1/orders/${placedOrderId}/cancel`)
        .set("Cookie", userACookie)
        .send({ reason: "Changed my mind" });

      expect(res.status).toBe(200);
      expect(res.body.data.order.orderStatus).toBe("CANCELLED");

      // Stock is restored by 2 units (8 + 2 = 10)!
      const afterProd = await Product.findById(product1Id);
      expect(afterProd.variants.id(variant1Id).stock).toBe(10);
    });

    it("Repeated cancellation is idempotent and does not multiply restored stock", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${placedOrderId}/cancel`)
        .set("Cookie", userACookie)
        .send({ reason: "Cancelled again" });

      expect(res.status).toBe(200);
      expect(res.body.data.order.orderStatus).toBe("CANCELLED");

      // Stock remains 10 (NOT 12!)
      const prod = await Product.findById(product1Id);
      expect(prod.variants.id(variant1Id).stock).toBe(10);
    });
  });

  describe("Admin Order State Machine Transitions", () => {
    let secondOrderId;

    beforeAll(async () => {
      // Clear user cart first
      await Cart.updateOne({ userId: userAId }, { $set: { items: [] } });

      // Place a new order for state machine transitions
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userACookie)
        .send({ productId: product1Id, variantId: variant1Id, quantity: 1 });

      const res = await request(app)
        .post("/api/v1/orders/checkout/cod")
        .set("Cookie", userACookie)
        .send({ addressId: addressAId });

      secondOrderId = res.body.data.order._id;
    });

    it("Admin can advance order from CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED", async () => {
      // 1. CONFIRMED -> PROCESSING
      const step1 = await request(app)
        .patch(`/api/v1/admin/orders/${secondOrderId}/status`)
        .set("Cookie", adminCookie)
        .send({ status: "PROCESSING", note: "Warehouse is packing" });
      expect(step1.status).toBe(200);
      expect(step1.body.data.order.orderStatus).toBe("PROCESSING");

      // 2. PROCESSING -> SHIPPED
      const step2 = await request(app)
        .patch(`/api/v1/admin/orders/${secondOrderId}/status`)
        .set("Cookie", adminCookie)
        .send({ status: "SHIPPED", note: "Handed to courier" });
      expect(step2.status).toBe(200);
      expect(step2.body.data.order.orderStatus).toBe("SHIPPED");

      // 3. SHIPPED -> DELIVERED
      const step3 = await request(app)
        .patch(`/api/v1/admin/orders/${secondOrderId}/status`)
        .set("Cookie", adminCookie)
        .send({ status: "DELIVERED", note: "Delivered to customer" });
      expect(step3.status).toBe(200);
      expect(step3.body.data.order.orderStatus).toBe("DELIVERED");
      // COD paymentStatus automatically completed on delivery!
      expect(step3.body.data.order.paymentStatus).toBe("COMPLETED");
    });

    it("Admin rejects illegal status transition from DELIVERED -> CANCELLED (terminal state)", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/orders/${secondOrderId}/status`)
        .set("Cookie", adminCookie)
        .send({ status: "CANCELLED", note: "Illegal transition" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid status transition");
    });
  });
});
