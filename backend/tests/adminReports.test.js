import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import env from "../src/config/env";
import User from "../src/modules/users/user.model";
import Category from "../src/modules/categories/category.model";
import Brand from "../src/modules/brands/brand.model";
import Product from "../src/modules/products/product.model";
import Order from "../src/modules/orders/order.model";
import Payment from "../src/modules/payments/payment.model";
import Refund from "../src/modules/refunds/refund.model";

describe("Phase 8 — Admin Dashboard, Reports, Export/PDF & Governance Tests", () => {
  let adminCookie;
  let userCookie;
  let adminId;
  let userId;
  let categoryId;
  let brandId;
  let productId;
  let variantId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite"
      );
    }

    await User.deleteMany({ email: { $in: ["admin.p8@example.com", "user.p8@example.com"] } });
    await Order.deleteMany({ orderNumber: { $regex: /^ORD-P8-/ } });
    await Product.deleteMany({ slug: "p8-test-smartwatch" });
    await Category.deleteMany({ slug: "p8-electronics" });
    await Brand.deleteMany({ slug: "p8-brand" });

    // Seed Admin
    const adminPass = await User.hashPassword("AdminPass123!");
    const admin = await User.create({
      name: "Phase8 Admin",
      email: "admin.p8@example.com",
      passwordHash: adminPass,
      role: "ADMIN",
      isVerified: true
    });
    adminId = admin._id.toString();

    const adminLoginRes = await request(app).post("/api/v1/auth/login").send({
      email: "admin.p8@example.com",
      password: "AdminPass123!"
    });
    adminCookie = adminLoginRes.headers["set-cookie"][0];

    // Seed Standard Customer
    const userPass = await User.hashPassword("UserPass123!");
    const user = await User.create({
      name: "Phase8 Customer",
      email: "user.p8@example.com",
      passwordHash: userPass,
      role: "USER",
      isVerified: true
    });
    userId = user._id.toString();

    const userLoginRes = await request(app).post("/api/v1/auth/login").send({
      email: "user.p8@example.com",
      password: "UserPass123!"
    });
    userCookie = userLoginRes.headers["set-cookie"][0];

    // Seed Category & Brand
    const cat = await Category.create({ name: "P8 Electronics", slug: "p8-electronics" });
    categoryId = cat._id;

    const brand = await Brand.create({ name: "P8 Brand", slug: "p8-brand" });
    brandId = brand._id;

    // Seed Product with 2 Variants (1 normal stock, 1 low stock)
    const prod = await Product.create({
      name: "P8 Test Smartwatch",
      slug: "p8-test-smartwatch",
      description: "Smartwatch for Phase 8 reports and inventory testing",
      category: categoryId,
      brand: brandId,
      basePrice: 1999,
      isActive: true,
      variants: [
        {
          sku: "P8-WATCH-BLK",
          attributes: { color: "Black" },
          price: 1999,
          costPrice: 1200,
          stock: 45,
          isActive: true
        },
        {
          sku: "P8-WATCH-SLV",
          attributes: { color: "Silver" },
          price: 2199,
          costPrice: 1400,
          stock: 4, // Low stock (< 10)
          isActive: true
        }
      ]
    });
    productId = prod._id;
    variantId = prod.variants[0]._id;

    // Seed Orders for Report Testing
    // 1. Captured Online Payment Order (Successful sale: grandTotal 2000, discount 300, shipping 100)
    const order1 = await Order.create({
      orderNumber: "ORD-P8-001",
      userId,
      items: [
        {
          productId,
          variantId,
          sku: "P8-WATCH-BLK",
          name: "P8 Test Smartwatch",
          slug: "p8-test-smartwatch",
          quantity: 1,
          unitPrice: 2200,
          discountedUnitPrice: 1900,
          itemTotal: 1900
        }
      ],
      shippingAddress: {
        fullName: "Test User",
        phone: "9876543210",
        addressLine1: "123 Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India"
      },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "COMPLETED",
      orderStatus: "CONFIRMED",
      priceSummary: {
        grossSubtotal: 2200,
        offerDiscountTotal: 300,
        netSubtotal: 1900,
        couponDiscount: 0,
        shippingFee: 100,
        grandTotal: 2000
      }
    });

    const payment1 = await Payment.create({
      orderId: order1._id,
      userId,
      amount: 200000, // 200000 paise
      committedRefundPaise: 50000, // 50000 paise refunded
      currency: "INR",
      gatewayOrderId: "order_p8_001",
      gatewayPaymentId: "pay_p8_001",
      status: "PARTIALLY_REFUNDED"
    });

    // Seed a Processed Refund for Order 1 (50000 paise = Rs 500)
    await Refund.create({
      refundNumber: "RFND-P8-001",
      orderId: order1._id,
      paymentId: payment1._id,
      userId,
      amount: 50000,
      reason: "Partial goodwill refund",
      status: "PROCESSED",
      refundType: "PARTIAL",
      gatewayPaymentId: "pay_p8_001",
      gatewayRefundId: "rfnd_p8_001",
      idempotencyKey: "p8-refund-key-1"
    });

    // 2. Confirmed COD Order (Successful sale: grandTotal 1500, discount 0, shipping 0)
    await Order.create({
      orderNumber: "ORD-P8-002",
      userId,
      items: [
        {
          productId,
          variantId,
          sku: "P8-WATCH-BLK",
          name: "P8 Test Smartwatch",
          slug: "p8-test-smartwatch",
          quantity: 1,
          unitPrice: 1500,
          discountedUnitPrice: 1500,
          itemTotal: 1500
        }
      ],
      shippingAddress: {
        fullName: "Test User",
        phone: "9876543210",
        addressLine1: "123 Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India"
      },
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "DELIVERED",
      priceSummary: {
        grossSubtotal: 1500,
        offerDiscountTotal: 0,
        netSubtotal: 1500,
        couponDiscount: 0,
        shippingFee: 0,
        grandTotal: 1500
      }
    });

    // 3. Unpaid Online PENDING Order (MUST BE EXCLUDED FROM SALES)
    await Order.create({
      orderNumber: "ORD-P8-UNPAID",
      userId,
      items: [
        {
          productId,
          variantId,
          sku: "P8-WATCH-BLK",
          name: "P8 Test Smartwatch",
          slug: "p8-test-smartwatch",
          quantity: 2,
          unitPrice: 2000,
          discountedUnitPrice: 2000,
          itemTotal: 4000
        }
      ],
      shippingAddress: {
        fullName: "Test User",
        phone: "9876543210",
        addressLine1: "123 Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India"
      },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      priceSummary: {
        grossSubtotal: 4000,
        offerDiscountTotal: 0,
        netSubtotal: 4000,
        couponDiscount: 0,
        shippingFee: 0,
        grandTotal: 4000
      }
    });

    // 4. Unpaid CANCELLED Order (MUST BE EXCLUDED FROM SALES)
    await Order.create({
      orderNumber: "ORD-P8-CANCELLED",
      userId,
      items: [
        {
          productId,
          variantId,
          sku: "P8-WATCH-BLK",
          name: "P8 Test Smartwatch",
          slug: "p8-test-smartwatch",
          quantity: 1,
          unitPrice: 3000,
          discountedUnitPrice: 3000,
          itemTotal: 3000
        }
      ],
      shippingAddress: {
        fullName: "Test User",
        phone: "9876543210",
        addressLine1: "123 Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India"
      },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "EXPIRED",
      orderStatus: "CANCELLED",
      priceSummary: {
        grossSubtotal: 3000,
        offerDiscountTotal: 0,
        netSubtotal: 3000,
        couponDiscount: 0,
        shippingFee: 0,
        grandTotal: 3000
      }
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ["admin.p8@example.com", "user.p8@example.com"] } });
    await Order.deleteMany({ orderNumber: { $regex: /^ORD-P8-/ } });
    await Product.deleteMany({ slug: "p8-test-smartwatch" });
    await Category.deleteMany({ slug: "p8-electronics" });
    await Brand.deleteMany({ slug: "p8-brand" });
    await Refund.deleteMany({ refundNumber: "RFND-P8-001" });
    await Payment.deleteMany({ gatewayOrderId: "order_p8_001" });
  });

  describe("1. Access Control & Authorization", () => {
    it("rejects unauthenticated requests with 401 Unauthorized", async () => {
      const res = await request(app).get("/api/v1/admin/reports/sales");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("rejects non-admin customers with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/sales")
        .set("Cookie", userCookie);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("allows authorized admin access with 200 OK", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/sales")
        .set("Cookie", adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
    });
  });

  describe("2. Financial Aggregation & Sales Metrics Accuracy", () => {
    it("correctly calculates gross sales, discounts, shipping, refunds, and net sales in paise", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/sales")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      const { summary } = res.body.data;

      // Eligible orders: ORD-P8-001 (Rs 2000) + ORD-P8-002 (Rs 1500) = Rs 3500 gross (350,000 paise)
      // Unpaid PENDING (Rs 4000) and CANCELLED (Rs 3000) are strictly excluded!
      expect(summary.orderCount).toBe(2);
      expect(summary.grossSalesPaise).toBe(350000);
      expect(summary.grossSalesRupees).toBe(3500);

      // Discounts: ORD-P8-001 discount = Rs 300 (30,000 paise)
      expect(summary.discountsPaise).toBe(30000);
      expect(summary.discountsRupees).toBe(300);

      // Shipping: ORD-P8-001 shipping = Rs 100 (10,000 paise)
      expect(summary.shippingPaise).toBe(10000);
      expect(summary.shippingRupees).toBe(100);

      // Refunds: RFND-P8-001 = 50,000 paise (Rs 500)
      expect(summary.refundsPaise).toBe(50000);
      expect(summary.refundsRupees).toBe(500);

      // Net Sales = grossSalesPaise - refundsPaise = 350,000 - 50,000 = 300,000 paise (Rs 3000)
      expect(summary.netSalesPaise).toBe(300000);
      expect(summary.netSalesRupees).toBe(3000);

      // AOV = 350,000 / 2 = 175,000 paise (Rs 1750)
      expect(summary.aovPaise).toBe(175000);
      expect(summary.aovRupees).toBe(1750);
    });

    it("verifies top-selling products aggregation", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/sales")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      const { topProducts } = res.body.data;
      expect(Array.isArray(topProducts)).toBe(true);

      const testWatch = topProducts.find((p) => p.sku === "P8-WATCH-BLK");
      expect(testWatch).toBeDefined();
      expect(testWatch.unitsSold).toBe(2);
      expect(testWatch.revenueRupees).toBe(3400); // 1900 + 1500
    });
  });

  describe("3. Date Range Validation & Filtering", () => {
    it("rejects invalid date format with 422 Unprocessable Entity", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/sales?from=invalid-date")
        .set("Cookie", adminCookie);
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it("rejects inverted date ranges (from > to) with 422 Unprocessable Entity", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/sales?from=2026-12-31&to=2026-01-01")
        .set("Cookie", adminCookie);
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it("filters orders correctly when querying a future date range with zero sales", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/sales?from=2030-01-01&to=2030-01-31")
        .set("Cookie", adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.summary.orderCount).toBe(0);
      expect(res.body.data.summary.grossSalesPaise).toBe(0);
      expect(res.body.data.summary.netSalesPaise).toBe(0);
    });
  });

  describe("4. CSV Export Streaming", () => {
    it("exports sales report as valid RFC 4180 CSV with correct headers", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/sales/export.csv")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.headers["content-disposition"]).toContain(".csv");

      const csv = res.text;
      expect(csv).toContain("PRIME STORE - SALES & OPERATIONS REPORT");
      expect(csv).toContain("EXECUTIVE FINANCIAL SUMMARY");
      expect(csv).toContain("Gross Sales,3500");
      expect(csv).toContain("Net Sales,3000");
      expect(csv).toContain("DAILY SALES BREAKDOWN");
      expect(csv).toContain("Date,Orders Count,Gross Sales (INR),Discounts (INR),Shipping (INR),Refunds (INR),Net Sales (INR)");
      expect(csv).toContain("TOP SELLING PRODUCTS");
    });
  });

  describe("5. PDF Export Streaming", () => {
    it("exports sales report as valid PDF binary with application/pdf header", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/sales/export.pdf")
        .set("Cookie", adminCookie)
        .responseType("blob");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.headers["content-disposition"]).toContain(".pdf");

      // Verify PDF magic bytes '%PDF'
      const magicBytes = res.body.slice(0, 4).toString();
      expect(magicBytes).toBe("%PDF");
    });
  });

  describe("6. Operational Dashboard Overview", () => {
    it("returns real-time operational counts across users, products, orders, and financials", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reports/dashboard")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.users).toBeDefined();
      expect(data.users.total).toBeGreaterThanOrEqual(1);

      expect(data.products).toBeDefined();
      expect(data.products.total).toBeGreaterThanOrEqual(1);
      expect(data.products.lowStock).toBeGreaterThanOrEqual(1); // P8-WATCH-SLV has 4 units

      expect(data.orders).toBeDefined();
      expect(data.orders.total).toBeGreaterThanOrEqual(2);

      expect(data.financials).toBeDefined();
      expect(data.financials.grossSalesPaise).toBeGreaterThanOrEqual(350000);
      expect(data.financials.netSalesPaise).toBeGreaterThanOrEqual(300000);

      expect(Array.isArray(data.recentOrders)).toBe(true);
      expect(data.recentOrders.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("7. Admin User Management", () => {
    it("lists users with pagination without exposing password hashes", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users?limit=10")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();

      for (const u of res.body.data.users) {
        expect(u.passwordHash).toBeUndefined();
      }
    });

    it("blocks a customer account with an administrative reason", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/block`)
        .set("Cookie", adminCookie)
        .send({ isBlocked: true, reason: "Violated terms of service" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isBlocked).toBe(true);

      // Verify user is now blocked in DB
      const updatedUser = await User.findById(userId);
      expect(updatedUser.isBlocked).toBe(true);
    });

    it("unblocks the customer account", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/block`)
        .set("Cookie", adminCookie)
        .send({ isBlocked: false, reason: "Appeal approved" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isBlocked).toBe(false);
    });

    it("prevents an admin from blocking their own account", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminId}/block`)
        .set("Cookie", adminCookie)
        .send({ isBlocked: true, reason: "Self block attempt" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("8. Admin Inventory Visibility", () => {
    it("returns variant-level inventory matrix with low-stock flags and cost prices", async () => {
      const res = await request(app)
        .get("/api/v1/admin/products/inventory")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.inventory)).toBe(true);

      const items = res.body.data.inventory;
      const silverVariant = items.find((i) => i.sku === "P8-WATCH-SLV");
      expect(silverVariant).toBeDefined();
      expect(silverVariant.stock).toBe(4);
      expect(silverVariant.isLowStock).toBe(true);
      expect(silverVariant.costPrice).toBe(1400); // Admin can view cost price
    });

    it("filters inventory by low-stock only", async () => {
      const res = await request(app)
        .get("/api/v1/admin/products/inventory?lowStockOnly=true")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      const items = res.body.data.inventory;
      for (const item of items) {
        expect(item.isLowStock).toBe(true);
      }
    });
  });
});
