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

describe("Customer Product Review Validation Boundary Audit Tests", () => {
  let customerCookie;
  let customerUser;
  let testCategory;
  let testBrand;
  let testProduct;
  let deliveredOrder;
  let deliveredOrderItemId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite"
      );
    }

    // Clean prior test artifacts
    await Review.deleteMany({ title: { $regex: /Audit/i } });
    await User.deleteMany({ email: "boundary.customer@example.com" });

    // Seed customer user
    const passHash = await User.hashPassword("Password123!");
    customerUser = await User.create({
      name: "Boundary Customer",
      email: "boundary.customer@example.com",
      passwordHash: passHash,
      role: "USER",
      isVerified: true
    });

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "boundary.customer@example.com", password: "Password123!" });
    customerCookie = loginRes.headers["set-cookie"][0];

    // Seed product
    testCategory = await Category.findOne({ slug: "audio" });
    if (!testCategory) {
      testCategory = await Category.create({ name: "Audio", slug: "audio", isActive: true });
    }

    testBrand = await Brand.findOne({ slug: "sony" });
    if (!testBrand) {
      testBrand = await Brand.create({ name: "Sony", slug: "sony", isActive: true });
    }

    testProduct = await Product.create({
      name: "Boundary Test Product",
      slug: "boundary-test-product-" + Date.now(),
      description: "Boundary test product description.",
      category: testCategory._id,
      brand: testBrand._id,
      basePrice: 999,
      isActive: true,
      variants: [
        {
          sku: "BND-" + Date.now(),
          price: 999,
          costPrice: 500,
          stock: 100,
          isActive: true
        }
      ]
    });

    deliveredOrderItemId = new mongoose.Types.ObjectId();
    deliveredOrder = await Order.create({
      orderNumber: "ORD-BND-" + Date.now(),
      userId: customerUser._id,
      shippingAddress: {
        fullName: "Boundary Customer",
        phone: "9876543210",
        addressLine1: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "India"
      },
      items: [
        {
          _id: deliveredOrderItemId,
          productId: testProduct._id,
          variantId: testProduct.variants[0]._id,
          sku: testProduct.variants[0].sku,
          name: testProduct.name,
          slug: testProduct.slug,
          unitPrice: 999,
          discountedUnitPrice: 999,
          quantity: 1,
          itemTotal: 999
        }
      ],
      priceSummary: {
        grossSubtotal: 999,
        offerDiscountTotal: 0,
        netSubtotal: 999,
        couponDiscount: 0,
        shippingFee: 0,
        grandTotal: 999
      },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "COMPLETED",
      orderStatus: "DELIVERED"
    });
  });

  afterAll(async () => {
    await Review.deleteMany({ productId: testProduct?._id });
    if (deliveredOrder) await Order.deleteOne({ _id: deliveredOrder._id });
    if (testProduct) await Product.deleteOne({ _id: testProduct._id });
    await User.deleteMany({ email: "boundary.customer@example.com" });
  });

  // 1. RATING BOUNDARY CASES
  describe("Rating Boundary Validation", () => {
    it("should reject rating: 0 with 422 Unprocessable Entity", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 0,
          title: "Audit Rating 0",
          comment: "Testing rating 0 lower bound.",
          orderItemId: deliveredOrderItemId.toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Rating must be at least 1");
    });

    it("should reject rating: 6 with 422 Unprocessable Entity", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 6,
          title: "Audit Rating 6",
          comment: "Testing rating 6 upper bound.",
          orderItemId: deliveredOrderItemId.toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Rating cannot exceed 5");
    });

    it("should reject decimal rating: 4.5 with 422 Unprocessable Entity", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 4.5,
          title: "Audit Decimal Rating",
          comment: "Testing decimal rating rejection.",
          orderItemId: deliveredOrderItemId.toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Rating must be an integer");
    });

    it("should reject missing rating with 422 Unprocessable Entity", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          title: "Audit Missing Rating",
          comment: "Testing missing rating.",
          orderItemId: deliveredOrderItemId.toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Rating is required");
    });
  });

  // 2. TITLE BOUNDARY CASES
  describe("Title Boundary Validation", () => {
    it("should accept empty title (optional on backend) when comment and rating are valid", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "",
          comment: "Review with blank title is accepted on backend.",
          orderItemId: deliveredOrderItemId.toString()
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("");
    });

    it("should reject excessively long title (> 100 chars) with 422 Unprocessable Entity", async () => {
      const longTitle = "A".repeat(101);
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: longTitle,
          comment: "Valid review comment with excessively long title.",
          orderItemId: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Review title cannot exceed 100 characters");
    });
  });

  // 3. COMMENT BOUNDARY CASES
  describe("Comment Boundary Validation", () => {
    it("should reject missing comment with 422 Unprocessable Entity", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Missing Comment Title",
          orderItemId: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Review comment is required");
    });

    it("should reject whitespace-only comment with 422 Unprocessable Entity", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Whitespace Comment Title",
          comment: "       ",
          orderItemId: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Review comment must be at least 2 characters");
    });

    it("should reject comment shorter than minimum (< 2 chars) with 422", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Too short comment",
          comment: "a",
          orderItemId: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Review comment must be at least 2 characters");
    });

    it("should reject excessively long comment (> 2000 chars) with 422", async () => {
      const longComment = "C".repeat(2001);
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Excessive Comment",
          comment: longComment,
          orderItemId: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Review comment cannot exceed 2000 characters");
    });
  });

  // 4. HTML/SCRIPT INPUT SANITIZATION
  describe("XSS and HTML Script Sanitization", () => {
    it("should sanitize script tags and HTML elements from title and comment", async () => {
      const cleanOrderItemId = new mongoose.Types.ObjectId();
      // Mock order for this clean item
      await Order.create({
        orderNumber: "ORD-SAN-" + Date.now(),
        userId: customerUser._id,
        shippingAddress: deliveredOrder.shippingAddress,
        items: [
          {
            _id: cleanOrderItemId,
            productId: testProduct._id,
            variantId: testProduct.variants[0]._id,
            sku: testProduct.variants[0].sku,
            name: testProduct.name,
            slug: testProduct.slug,
            unitPrice: 999,
            discountedUnitPrice: 999,
            quantity: 1,
            itemTotal: 999
          }
        ],
        priceSummary: deliveredOrder.priceSummary,
        paymentMethod: "ONLINE_RAZORPAY",
        paymentStatus: "COMPLETED",
        orderStatus: "DELIVERED"
      });

      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "<script>alert('xss')</script><b>Clean Title</b>",
          comment: "<p>This is a <script src='evil.js'></script>clean comment with <strong>bold</strong> text.</p>",
          orderItemId: cleanOrderItemId.toString()
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Clean Title");
      expect(res.body.data.comment).toBe("This is a clean comment with bold text.");
      expect(res.body.data.title).not.toContain("<script>");
      expect(res.body.data.comment).not.toContain("<script");
      expect(res.body.data.comment).not.toContain("<p>");
    });
  });

  // 5. MALFORMED ID PARAMETER VALIDATION
  describe("ID Parameter Validation", () => {
    it("should reject malformed productId parameter with 422 Unprocessable Entity", async () => {
      const res = await request(app)
        .post("/api/v1/products/invalid-hex-id-123/reviews")
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Valid Title",
          comment: "Valid review comment.",
          orderItemId: deliveredOrderItemId.toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Invalid Product ID format");
    });

    it("should reject malformed reviewId parameter in PUT with 422", async () => {
      const res = await request(app)
        .put("/api/v1/reviews/not-a-valid-review-id")
        .set("Cookie", customerCookie)
        .send({
          rating: 4,
          comment: "Updated comment text"
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Invalid Review ID format");
    });

    it("should reject malformed orderId format in request body with 422", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Malformed Order ID",
          comment: "Valid review comment text.",
          orderId: "invalid-order-id",
          orderItemId: deliveredOrderItemId.toString()
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Invalid Order ID format");
    });

    it("should reject malformed orderItemId format in request body with 422", async () => {
      const res = await request(app)
        .post(`/api/v1/products/${testProduct._id}/reviews`)
        .set("Cookie", customerCookie)
        .send({
          rating: 5,
          title: "Malformed Order Item ID",
          comment: "Valid review comment text.",
          orderItemId: "invalid-item-id"
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain("Invalid Order Item ID format");
    });
  });
});
