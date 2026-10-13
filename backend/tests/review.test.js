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
import Review from "../src/modules/reviews/review.model";

describe("Customer Product Ratings & Reviews Module (Comprehensive Integration Tests)", () => {
  let customerCookie;
  let customerUser;
  let otherCustomerCookie;
  let otherCustomerUser;
  let adminCookie;
  let adminUser;

  let testCategory;
  let testBrand;
  let testProduct;
  let deliveredOrder;
  let deliveredOrderItemId;
  let undeliveredOrder;
  let undeliveredOrderItemId;
  let otherUserOrder;
  let otherUserOrderItemId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite"
      );
    }

    await Review.syncIndexes();

    // Clean prior test artifacts
    await Review.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({
      email: { $in: ["review.customer@example.com", "review.other@example.com", "review.admin@example.com"] }
    });

    // Seed test Category & Brand
    testCategory = await Category.create({ name: "Audio", slug: "audio", isActive: true });
    testBrand = await Brand.create({ name: "Sony", slug: "sony", isActive: true });

    // Seed Product
    testProduct = await Product.create({
      name: "WH-1000XM5 Wireless Headphones",
      slug: "wh-1000xm5-wireless-headphones",
      description: "Industry leading noise canceling headphones.",
      category: testCategory._id,
      brand: testBrand._id,
      isActive: true,
      variants: [
        {
          sku: "WH-1000XM5-BLK",
          price: 29990,
          costPrice: 20000,
          stock: 50,
          isActive: true
        }
      ]
    });

    // Seed Users
    const passHash = await User.hashPassword("Password123!");

    customerUser = await User.create({
      name: "Reviewer Customer",
      email: "review.customer@example.com",
      passwordHash: passHash,
      role: "USER",
      isVerified: true
    });

    otherCustomerUser = await User.create({
      name: "Other Customer",
      email: "review.other@example.com",
      passwordHash: passHash,
      role: "USER",
      isVerified: true
    });

    adminUser = await User.create({
      name: "Review Admin",
      email: "review.admin@example.com",
      passwordHash: passHash,
      role: "ADMIN",
      isVerified: true
    });

    // Log in users to get session cookies
    const customerLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "review.customer@example.com", password: "Password123!" });
    customerCookie = customerLogin.headers["set-cookie"][0];

    const otherLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "review.other@example.com", password: "Password123!" });
    otherCustomerCookie = otherLogin.headers["set-cookie"][0];

    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "review.admin@example.com", password: "Password123!" });
    adminCookie = adminLogin.headers["set-cookie"][0];

    const variantId = testProduct.variants[0]._id;

    // Seed Delivered Order for customerUser
    deliveredOrder = await Order.create({
      orderNumber: "ORD-DELIV-001",
      userId: customerUser._id,
      shippingAddress: {
        fullName: "Reviewer Customer",
        phone: "9876543210",
        addressLine1: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "India"
      },
      items: [
        {
          productId: testProduct._id,
          variantId,
          sku: "WH-1000XM5-BLK",
          name: "WH-1000XM5 Wireless Headphones",
          slug: "wh-1000xm5-wireless-headphones",
          unitPrice: 29990,
          discountedUnitPrice: 29990,
          quantity: 1,
          itemTotal: 29990
        }
      ],
      priceSummary: {
        grossSubtotal: 29990,
        offerDiscountTotal: 0,
        netSubtotal: 29990,
        couponDiscount: 0,
        shippingFee: 0,
        grandTotal: 29990
      },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "COMPLETED",
      orderStatus: "DELIVERED"
    });
    deliveredOrderItemId = deliveredOrder.items[0]._id.toString();

    // Seed Undelivered (SHIPPED) Order for customerUser
    undeliveredOrder = await Order.create({
      orderNumber: "ORD-SHIPPED-002",
      userId: customerUser._id,
      shippingAddress: {
        fullName: "Reviewer Customer",
        phone: "9876543210",
        addressLine1: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "India"
      },
      items: [
        {
          productId: testProduct._id,
          variantId,
          sku: "WH-1000XM5-BLK",
          name: "WH-1000XM5 Wireless Headphones",
          slug: "wh-1000xm5-wireless-headphones",
          unitPrice: 29990,
          discountedUnitPrice: 29990,
          quantity: 1,
          itemTotal: 29990
        }
      ],
      priceSummary: {
        grossSubtotal: 29990,
        offerDiscountTotal: 0,
        netSubtotal: 29990,
        couponDiscount: 0,
        shippingFee: 0,
        grandTotal: 29990
      },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "COMPLETED",
      orderStatus: "SHIPPED"
    });
    undeliveredOrderItemId = undeliveredOrder.items[0]._id.toString();

    // Seed Delivered Order for otherCustomerUser
    otherUserOrder = await Order.create({
      orderNumber: "ORD-OTHER-003",
      userId: otherCustomerUser._id,
      shippingAddress: {
        fullName: "Other Customer",
        phone: "9876543211",
        addressLine1: "456 Other Street",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India"
      },
      items: [
        {
          productId: testProduct._id,
          variantId,
          sku: "WH-1000XM5-BLK",
          name: "WH-1000XM5 Wireless Headphones",
          slug: "wh-1000xm5-wireless-headphones",
          unitPrice: 29990,
          discountedUnitPrice: 29990,
          quantity: 1,
          itemTotal: 29990
        }
      ],
      priceSummary: {
        grossSubtotal: 29990,
        offerDiscountTotal: 0,
        netSubtotal: 29990,
        couponDiscount: 0,
        shippingFee: 0,
        grandTotal: 29990
      },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "COMPLETED",
      orderStatus: "DELIVERED"
    });
    otherUserOrderItemId = otherUserOrder.items[0]._id.toString();
  });

  afterAll(async () => {
    await Review.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({
      email: { $in: ["review.customer@example.com", "review.other@example.com", "review.admin@example.com"] }
    });
  });

  // ============================================================================
  // 1. AUTHENTICATION & ACCESS GATING
  // ============================================================================
  describe("Authentication & Access Gating", () => {
    it("should reject unauthenticated review creation with 401 Unauthorized", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .send({
          rating: 5,
          title: "Amazing Sound",
          comment: "Best noise cancelling ever experienced.",
          orderId: deliveredOrder._id.toString(),
          orderItemId: deliveredOrderItemId
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should allow public access to GET product reviews without session cookie", async () => {
      const res = await request(app).get(`/api/v1/products/${testProduct._id}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reviews).toBeInstanceOf(Array);
      expect(res.body.data.summary).toBeDefined();
    });
  });

  // ============================================================================
  // 2. VERIFIED PURCHASE VALIDATION RULES
  // ============================================================================
  describe("Verified Purchase Validation & Error Scenarios", () => {
    it("should reject review when order does NOT belong to authenticated user (IDOR prevention)", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Stealing other's order",
          comment: "Trying to review another user's purchased item.",
          orderId: otherUserOrder._id.toString(),
          orderItemId: otherUserOrderItemId
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("does not belong to the authenticated user");
    });

    it("should reject review when order has NOT reached DELIVERED state", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 4,
          title: "Too early review",
          comment: "The item has only shipped but not delivered.",
          orderId: undeliveredOrder._id.toString(),
          orderItemId: undeliveredOrderItemId
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("only be submitted for delivered orders");
    });

    it("should reject review when order does not contain specified product", async () => {
      const fakeProductId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/v1/products/${fakeProductId}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Mismatched Product",
          comment: "Product ID does not match item in order.",
          orderId: deliveredOrder._id.toString(),
          orderItemId: deliveredOrderItemId
        });

      expect(res.status).toBe(404); // Product not found
      expect(res.body.success).toBe(false);
    });

    it("should reject review creation with invalid rating values", async () => {
      // Rating 0 (< 1)
      const resZero = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 0,
          comment: "Too low rating",
          orderId: deliveredOrder._id.toString(),
          orderItemId: deliveredOrderItemId
        });
      expect(resZero.status).toBe(422);

      // Rating 6 (> 5)
      const resSix = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 6,
          comment: "Too high rating",
          orderId: deliveredOrder._id.toString(),
          orderItemId: deliveredOrderItemId
        });
      expect(resSix.status).toBe(422);

      // Decimal rating (4.5)
      const resDecimal = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 4.5,
          comment: "Non integer rating",
          orderId: deliveredOrder._id.toString(),
          orderItemId: deliveredOrderItemId
        });
      expect(resDecimal.status).toBe(422);
    });

    it("should reject review creation when comment is missing or too short", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Title without comment",
          orderId: deliveredOrder._id.toString(),
          orderItemId: deliveredOrderItemId
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================================
  // 3. SUCCESSFUL REVIEW CREATION & DUPLICATE PREVENTION
  // ============================================================================
  describe("Successful Review Creation & Business Rule Enforcement", () => {
    let createdReviewId;

    it("should successfully create a verified purchase review for an eligible delivered order item", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Incredible Noise Cancellation",
          comment: "Super comfortable for long flights and audio clarity is top notch!",
          orderId: deliveredOrder._id.toString(),
          orderItemId: deliveredOrderItemId
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.title).toBe("Incredible Noise Cancellation");
      expect(res.body.data.isVerifiedPurchase).toBe(true);
      expect(res.body.data.status).toBe("PUBLISHED");

      createdReviewId = res.body.data._id;
    });

    it("should enforce duplicate review prevention for the exact same purchased order item", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 4,
          title: "Trying duplicate submission",
          comment: "Should fail because this order item was already reviewed.",
          orderId: deliveredOrder._id.toString(),
          orderItemId: deliveredOrderItemId
        });

      expect(res.status).toBe(409); // Conflict
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already been submitted");
    });

    it("should allow other customers to submit review for their own delivered order item", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", otherCustomerCookie)
        .send({
          rating: 4,
          title: "Solid Battery Life",
          comment: "Battery lasts easily over 30 hours. ANC is great.",
          orderId: otherUserOrder._id.toString(),
          orderItemId: otherUserOrderItemId
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBe(4);
    });

    it("should verify customer review eligibility via eligibility endpoint", async () => {
      const res = await request(app)
        .get(`/api/v1/products/${testProduct._id}/reviews/eligibility`)
        .set("Cookie", customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasDeliveredPurchase).toBe(true);
      expect(res.body.data.alreadyReviewed).toBe(true);
      expect(res.body.data.canReview).toBe(false); // Already reviewed all purchased items
      expect(res.body.data.userReview).toBeDefined();
    });
  });

  // ============================================================================
  // 4. RATING AGGREGATION & SUMMARY
  // ============================================================================
  describe("Product Rating Summary & Aggregation Pipeline", () => {
    it("should compute accurate average rating and star distribution via aggregation", async () => {
      const res = await request(app).get(`/api/v1/products/${testProduct._id}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { summary } = res.body.data;
      // We submitted one 5-star and one 4-star review -> avg = 4.5, count = 2
      expect(summary.count).toBe(2);
      expect(summary.average).toBe(4.5);
      expect(summary.distribution[5]).toBe(1);
      expect(summary.distribution[4]).toBe(1);
      expect(summary.distribution[3]).toBe(0);
      expect(summary.distribution[2]).toBe(0);
      expect(summary.distribution[1]).toBe(0);
    });

    it("should expose rating summary on GET /products/:slug without breaking product contract", async () => {
      const res = await request(app).get(`/api/v1/products/${testProduct.slug}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rating).toBeDefined();
      expect(res.body.data.rating.average).toBe(4.5);
      expect(res.body.data.rating.count).toBe(2);
      expect(res.body.data.ratingSummary).toBeDefined();
      expect(res.body.data.ratingSummary.distribution).toBeDefined();
    });

    it("should expose rating on catalog listing GET /products", async () => {
      const res = await request(app).get(`/api/v1/products?search=Headphones`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const prod = res.body.data.find((p) => p._id.toString() === testProduct._id.toString());
      expect(prod).toBeDefined();
      expect(prod.rating).toBeDefined();
      expect(prod.rating.count).toBe(2);
      expect(prod.rating.average).toBe(4.5);
    });
  });

  // ============================================================================
  // 5. REVIEW MUTATION (UPDATE & DELETE) WITH OWNERSHIP CHECKS
  // ============================================================================
  describe("Review Update and Deletion (Ownership & IDOR Protection)", () => {
    let customerReview;

    beforeAll(async () => {
      customerReview = await Review.findOne({ userId: customerUser._id });
    });

    it("should reject update attempt by another customer with 403 Forbidden", async () => {
      const res = await request(app)
        .put(`/api/v1/reviews/${customerReview._id}`)
        .set("Cookie", otherCustomerCookie)
        .send({
          rating: 1,
          comment: "Maliciously changing someone else's review."
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow owner to update their own review rating and comment", async () => {
      const res = await request(app)
        .put(`/api/v1/reviews/${customerReview._id}`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Updated Title: Even Better After 1 Month",
          comment: "Still the best headphones after 30 days of daily use!"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain("Updated Title");
      expect(res.body.data.comment).toContain("30 days");
    });

    it("should reject delete attempt by another customer with 403 Forbidden", async () => {
      const res = await request(app)
        .delete(`/api/v1/reviews/${customerReview._id}`)
        .set("Cookie", otherCustomerCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow owner to delete their own review", async () => {
      const res = await request(app)
        .delete(`/api/v1/reviews/${customerReview._id}`)
        .set("Cookie", customerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await Review.findById(customerReview._id);
      expect(deleted).toBeNull();
    });

    it("should update product rating summary dynamically after review deletion", async () => {
      const res = await request(app).get(`/api/v1/products/${testProduct._id}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.count).toBe(1); // Only other customer's 4-star review remains
      expect(res.body.data.summary.average).toBe(4);
    });
  });

  // ============================================================================
  // 6. ADMINISTRATIVE MODERATION & VISIBILITY FILTERING
  // ============================================================================
  describe("Admin Review Moderation & Customer Visibility", () => {
    let otherReview;

    beforeAll(async () => {
      otherReview = await Review.findOne({ userId: otherCustomerUser._id });
    });

    it("should reject non-admin users from accessing GET /api/v1/admin/reviews", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reviews")
        .set("Cookie", customerCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow admin to view all reviews with pagination and product details", async () => {
      const res = await request(app)
        .get("/api/v1/admin/reviews")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
    });

    it("should allow admin to hide a review (PATCH status: HIDDEN)", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/reviews/${otherReview._id}/status`)
        .set("Cookie", adminCookie)
        .send({ status: "HIDDEN" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("HIDDEN");
    });

    it("should exclude HIDDEN reviews from public customer review queries", async () => {
      const res = await request(app).get(`/api/v1/products/${testProduct._id}/reviews`);

      expect(res.status).toBe(200);
      expect(res.body.data.reviews.length).toBe(0); // Hidden review excluded
      expect(res.body.data.summary.count).toBe(0); // Excluded from public summary
    });

    it("should allow admin to restore a hidden review (PATCH status: PUBLISHED)", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/reviews/${otherReview._id}/status`)
        .set("Cookie", adminCookie)
        .send({ status: "PUBLISHED" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PUBLISHED");

      const publicRes = await request(app).get(`/api/v1/products/${testProduct._id}/reviews`);
      expect(publicRes.body.data.reviews.length).toBe(1);
    });

    it("should allow admin to permanently delete a review", async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/reviews/${otherReview._id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await Review.findById(otherReview._id);
      expect(check).toBeNull();
    });
  });
});
