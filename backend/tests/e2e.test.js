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
import { OTP } from "../src/modules/auth/otp.model";

describe("Phase 9 — End-to-End (E2E) Flow & Security Verification", () => {
  let customerEmail = "e2e.customer@example.com";
  let adminEmail = "e2e.admin@example.com";
  let customerCookie;
  let adminCookie;
  let customerId;
  let adminId;
  let categoryId;
  let brandId;
  let productId;
  let variantId;
  let orderId;
  let orderNumber;
  let initialStock = 25;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite"
      );
    }

    // Clean previous test data
    await User.deleteMany({ email: { $in: [customerEmail, adminEmail, "session.fixation@example.com"] } });
    await Order.deleteMany({ orderNumber: { $regex: /^ORD-E2E-/ } });
    await Product.deleteMany({ slug: "e2e-aurora-watch" });
    await Category.deleteMany({ slug: "e2e-wearables" });
    await Brand.deleteMany({ slug: "e2e-aurora-brand" });
    await OTP.deleteMany({ email: { $in: [customerEmail, "session.fixation@example.com"] } });

    // Seed Taxonomy & Product
    const category = await Category.create({
      name: "E2E Wearables",
      slug: "e2e-wearables",
      description: "Wearable tech for E2E validation",
      isActive: true
    });
    categoryId = category._id.toString();

    const brand = await Brand.create({
      name: "E2E Aurora",
      slug: "e2e-aurora-brand",
      description: "Brand for E2E validation",
      isActive: true
    });
    brandId = brand._id.toString();

    const product = await Product.create({
      name: "Aurora E2E Smartwatch",
      slug: "e2e-aurora-watch",
      description: "High precision smartwatch for automated E2E lifecycle testing",
      category: category._id,
      brand: brand._id,
      isActive: true,
      variants: [
        {
          sku: "E2E-WATCH-BLK",
          attributes: { color: "Midnight Black" },
          price: 4999, // ₹4999
          costPrice: 2500, // ₹2500 wholesale
          stock: initialStock,
          isActive: true
        }
      ]
    });
    productId = product._id.toString();
    variantId = product.variants[0]._id.toString();

    // Seed Admin Account
    const adminPass = await User.hashPassword("AdminPass123!");
    const admin = await User.create({
      name: "E2E Platform Administrator",
      email: adminEmail,
      passwordHash: adminPass,
      role: "ADMIN",
      isVerified: true
    });
    adminId = admin._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: [customerEmail, adminEmail, "session.fixation@example.com"] } });
    await Order.deleteMany({ orderNumber: { $regex: /^ORD-E2E-/ } });
    await Product.deleteMany({ slug: "e2e-aurora-watch" });
    await Category.deleteMany({ slug: "e2e-wearables" });
    await Brand.deleteMany({ slug: "e2e-aurora-brand" });
    await OTP.deleteMany({ email: { $in: [customerEmail, "session.fixation@example.com"] } });
  });

  // ============================================================================
  // 1. CUSTOMER FULL LIFECYCLE
  // ============================================================================

  it("1. Customer Registration: Initiates signup and dispatches OTP", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "E2E Customer",
        email: customerEmail,
        password: "CustomerPass123!"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("email", customerEmail);
  });

  it("2. Customer OTP Verification: Establishes authenticated session with fixation protection", async () => {
    // Find unhashed OTP in test context via mock/OTP records
    const otpDoc = await OTP.findOne({ email: customerEmail, purpose: "REGISTRATION", isUsed: false });
    expect(otpDoc).toBeTruthy();

    // To verify, test with correct OTP via verifyOtp API
    // We update OTP with known plaintext hash for deterministic test
    const { plainOtp, hashedOtp } = OTP.generateOtp({ purpose: "REGISTRATION", email: customerEmail });
    otpDoc.hashedOtp = hashedOtp;
    await otpDoc.save();

    const res = await request(app)
      .post("/api/v1/auth/verify-otp")
      .send({
        email: customerEmail,
        otp: plainOtp,
        purpose: "REGISTRATION"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers["set-cookie"]).toBeDefined();
    customerCookie = res.headers["set-cookie"][0];

    // Verify session user details
    const meRes = await request(app).get("/api/v1/auth/me").set("Cookie", customerCookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(customerEmail);
    expect(meRes.body.data.user.isVerified).toBe(true);
    customerId = meRes.body.data.user._id;
  });

  it("3. Catalog Discovery: Customer browses published products and selects variant", async () => {
    const res = await request(app).get("/api/v1/products?category=e2e-wearables");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const prod = res.body.data[0];
    expect(prod.name).toBe("Aurora E2E Smartwatch");
    // Verify costPrice is strictly projected away from public view
    expect(prod.variants[0].costPrice).toBeUndefined();
  });

  it("4. Cart Management: Customer adds variant to cart and inspects line items", async () => {
    const res = await request(app)
      .post("/api/v1/cart/items")
      .set("Cookie", customerCookie)
      .send({
        productId,
        variantId,
        quantity: 2
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cart.items.length).toBe(1);
    expect(res.body.data.cart.items[0].quantity).toBe(2);
  });

  it("5. Checkout Summary: Server authoritatively derives totals from database cart", async () => {
    const res = await request(app)
      .post("/api/v1/checkout/summary")
      .set("Cookie", customerCookie)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.grossSubtotal).toBe(9998); // 4999 * 2
  });

  let addressId;
  it("6. Order Placement: Customer adds address and places COD order, stock decrements atomically", async () => {
    const addrRes = await request(app)
      .post("/api/v1/addresses")
      .set("Cookie", customerCookie)
      .send({
        fullName: "E2E Customer",
        phone: "9876543210",
        addressLine1: "123 Tech Park Blvd",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
        isDefault: true
      });
    expect(addrRes.status).toBe(201);
    addressId = addrRes.body.data.address._id;

    const res = await request(app)
      .post("/api/v1/orders/checkout/cod")
      .set("Cookie", customerCookie)
      .send({ addressId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    orderId = res.body.data.order._id;
    orderNumber = res.body.data.order.orderNumber;
    expect(orderNumber).toBeDefined();

    // Verify atomic upfront stock decrement (25 - 2 = 23)
    const updatedProd = await Product.findById(productId);
    expect(updatedProd.variants[0].stock).toBe(initialStock - 2);
  });

  it("7. Customer Order Inspection & Auto-Initialized Wallet", async () => {
    // Order query
    const orderRes = await request(app).get(`/api/v1/orders/${orderId}`).set("Cookie", customerCookie);
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.order._id).toBe(orderId);

    // Wallet query (auto-initializes with 0 balance)
    const walletRes = await request(app).get("/api/v1/wallet").set("Cookie", customerCookie);
    expect(walletRes.status).toBe(200);
    expect(walletRes.body.data.wallet.balance).toBe(0);
  });

  // ============================================================================
  // 2. ADMIN OPERATIONS & GOVERNANCE
  // ============================================================================

  it("8. Admin Authentication: Logs in and acquires ADMIN session", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: adminEmail,
        password: "AdminPass123!"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("ADMIN");
    adminCookie = res.headers["set-cookie"][0];
  });

  it("9. Operational Dashboard: Admin retrieves platform aggregates", async () => {
    const res = await request(app)
      .get("/api/v1/admin/reports/dashboard")
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("users");
    expect(res.body.data).toHaveProperty("products");
    expect(res.body.data).toHaveProperty("orders");
    expect(res.body.data).toHaveProperty("financials");
  });

  it("10. Variant Inventory Matrix: Admin reviews SKU stock and wholesale costPrice", async () => {
    const res = await request(app)
      .get("/api/v1/admin/products/inventory")
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const item = res.body.data.inventory.find((i) => i.sku === "E2E-WATCH-BLK");
    expect(item).toBeDefined();
    expect(item.stock).toBe(initialStock - 2);
    expect(item.costPrice).toBe(2500); // 2500 INR
  });

  it("11. User Management: Admin lists registered accounts with role and status", async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users?search=${encodeURIComponent(customerEmail)}`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users.length).toBe(1);
    expect(res.body.data.users[0].email).toBe(customerEmail);
  });

  it("12. Sales Report, CSV & PDF Exports: Streams analytics without binary bloat", async () => {
    // JSON Report
    const reportRes = await request(app)
      .get("/api/v1/admin/reports/sales")
      .set("Cookie", adminCookie);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.success).toBe(true);

    // CSV Export
    const csvRes = await request(app)
      .get("/api/v1/admin/reports/sales/csv")
      .set("Cookie", adminCookie);
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.text).toContain("PRIME STORE - SALES & OPERATIONS REPORT");

    // PDF Streaming Export (PDFKit)
    const pdfRes = await request(app)
      .get("/api/v1/admin/reports/sales/pdf")
      .set("Cookie", adminCookie);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers["content-type"]).toContain("application/pdf");
    expect(pdfRes.body.length).toBeGreaterThan(500); // Binary PDF buffer
  });

  // ============================================================================
  // 3. RETURN & RESTOCK LIFECYCLE
  // ============================================================================

  it("13. Multi-Step Return Workflow: Customer requests -> Admin reviews -> Warehouse receives -> Restocks", async () => {
    // Advance order to DELIVERED so return can be requested
    await Order.findByIdAndUpdate(orderId, { orderStatus: "DELIVERED" });

    // Step A: Customer requests return
    const returnReqRes = await request(app)
      .post(`/api/v1/orders/${orderId}/return`)
      .set("Cookie", customerCookie)
      .send({ reason: "Slight fit preference issue; pristine packaging." });
    expect(returnReqRes.status).toBe(200);

    // Step B: Admin approves RMA (Stock STILL untouched)
    const reviewRes = await request(app)
      .post(`/api/v1/admin/orders/${orderId}/return/review`)
      .set("Cookie", adminCookie)
      .send({ decision: "APPROVED" });
    expect(reviewRes.status).toBe(200);

    let checkProd = await Product.findById(productId);
    expect(checkProd.variants[0].stock).toBe(initialStock - 2); // Unchanged!

    // Step C: Courier delivers parcel, warehouse marks received
    const receiveRes = await request(app)
      .post(`/api/v1/admin/orders/${orderId}/return/receive`)
      .set("Cookie", adminCookie);
    expect(receiveRes.status).toBe(200);

    // Step D: Quality inspection passed + restock true
    const inspectRes = await request(app)
      .post(`/api/v1/admin/orders/${orderId}/return/inspect`)
      .set("Cookie", adminCookie)
      .send({
        inspectionPassed: true,
        restock: true,
        notes: "Unopened retail box, seals fully intact."
      });
    expect(inspectRes.status).toBe(200);

    // Verify stock is now atomically restored (+2)
    const finalProd = await Product.findById(productId);
    expect(finalProd.variants[0].stock).toBe(initialStock);
  });

  // ============================================================================
  // 4. SECURITY & INVARIANTS HARDENING
  // ============================================================================

  it("14. Security Defense: Customer attempting administrative endpoints receives 403 Forbidden", async () => {
    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Cookie", customerCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("15. Security Defense: Unauthenticated request to protected endpoint receives 401 Unauthorized", async () => {
    const res = await request(app).get("/api/v1/orders");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("16. Session Fixation Defense: Login generates a new session identifier", async () => {
    // 1. Send request without auth to receive initial session cookie
    const guestRes = await request(app).get("/api/v1/auth/me");
    const preAuthCookie = guestRes.headers["set-cookie"] ? guestRes.headers["set-cookie"][0] : null;

    // 2. Login with that session cookie attached
    const loginReq = request(app).post("/api/v1/auth/login");
    if (preAuthCookie) {
      loginReq.set("Cookie", preAuthCookie);
    }
    const loginRes = await loginReq.send({
      email: adminEmail,
      password: "AdminPass123!"
    });

    expect(loginRes.status).toBe(200);
    const postAuthCookie = loginRes.headers["set-cookie"][0];
    expect(postAuthCookie).toBeDefined();

    // If preAuthCookie existed, assert postAuthCookie has a completely different session ID
    if (preAuthCookie) {
      const preSessionId = preAuthCookie.split(";")[0];
      const postSessionId = postAuthCookie.split(";")[0];
      expect(postSessionId).not.toBe(preSessionId);
    }
  });

  it("17. Session Invalidation on Password Change: Active session is invalidated after password update", async () => {
    // Login to get active session
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: customerEmail,
      password: "CustomerPass123!"
    });
    expect(loginRes.status).toBe(200);
    const activeCookie = loginRes.headers["set-cookie"][0];

    // Change password
    const changePassRes = await request(app)
      .patch("/api/v1/auth/password")
      .set("Cookie", activeCookie)
      .send({
        currentPassword: "CustomerPass123!",
        newPassword: "NewCustomerPass456!"
      });
    expect(changePassRes.status).toBe(200);

    // Verify that subsequent request with the old session is rejected
    const testOldSessionRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", activeCookie);

    expect(testOldSessionRes.status).toBe(401);
    expect(testOldSessionRes.body.message).toContain("Password was recently updated");
  });
});
