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

describe("TDD Feature: Customer Review Helpful Vote", () => {
  let authorCookie;
  let authorUser;
  let voter1Cookie;
  let voter1User;
  let voter2Cookie;
  let voter2User;

  let testCategory;
  let testBrand;
  let testProduct;
  let testOrder;
  let testOrderItemId;
  let testReview;
  let hiddenReview;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite"
      );
    }

    // Clean prior test artifacts
    await Review.deleteMany({ title: { $in: ["Helpful Test Review", "Hidden Helpful Review"] } });
    await User.deleteMany({
      email: { $in: ["helpful.author@example.com", "helpful.voter1@example.com", "helpful.voter2@example.com"] }
    });

    // Seed Users
    const passHash = await User.hashPassword("Password123!");

    authorUser = await User.create({
      name: "Helpful Author",
      email: "helpful.author@example.com",
      passwordHash: passHash,
      role: "USER",
      isVerified: true
    });

    voter1User = await User.create({
      name: "Helpful Voter One",
      email: "helpful.voter1@example.com",
      passwordHash: passHash,
      role: "USER",
      isVerified: true
    });

    voter2User = await User.create({
      name: "Helpful Voter Two",
      email: "helpful.voter2@example.com",
      passwordHash: passHash,
      role: "USER",
      isVerified: true
    });

    // Log in to acquire session cookies
    const authorLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "helpful.author@example.com", password: "Password123!" });
    authorCookie = authorLogin.headers["set-cookie"] ? authorLogin.headers["set-cookie"][0] : null;

    const voter1Login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "helpful.voter1@example.com", password: "Password123!" });
    voter1Cookie = voter1Login.headers["set-cookie"] ? voter1Login.headers["set-cookie"][0] : null;

    const voter2Login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "helpful.voter2@example.com", password: "Password123!" });
    voter2Cookie = voter2Login.headers["set-cookie"] ? voter2Login.headers["set-cookie"][0] : null;

    // Seed Category & Brand & Product
    testCategory = await Category.findOne({ slug: "audio" });
    if (!testCategory) {
      testCategory = await Category.create({ name: "Audio", slug: "audio", isActive: true });
    }

    testBrand = await Brand.findOne({ slug: "sony" });
    if (!testBrand) {
      testBrand = await Brand.create({ name: "Sony", slug: "sony", isActive: true });
    }

    testProduct = await Product.create({
      name: "Helpful Test Headphones",
      slug: "helpful-test-headphones-" + Date.now(),
      description: "Headphones for helpful vote testing.",
      category: testCategory._id,
      brand: testBrand._id,
      basePrice: 5999,
      isActive: true,
      variants: [
        {
          sku: "HTH-" + Date.now(),
          price: 5999,
          costPrice: 4000,
          stock: 50,
          isActive: true
        }
      ]
    });

    testOrderItemId = new mongoose.Types.ObjectId();
    testOrder = await Order.create({
      orderNumber: "ORD-HELPFUL-" + Date.now(),
      userId: authorUser._id,
      shippingAddress: {
        fullName: "Helpful Author",
        phone: "9876543210",
        addressLine1: "123 Tech Park",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        postalCode: "560001"
      },
      items: [
        {
          _id: testOrderItemId,
          productId: testProduct._id,
          variantId: testProduct.variants[0]._id,
          sku: testProduct.variants[0].sku,
          name: testProduct.name,
          slug: testProduct.slug,
          unitPrice: 5999,
          discountedUnitPrice: 5999,
          quantity: 1,
          itemTotal: 5999
        }
      ],
      priceSummary: {
        grossSubtotal: 5999,
        offerDiscountTotal: 0,
        netSubtotal: 5999,
        couponDiscount: 0,
        shippingFee: 0,
        grandTotal: 5999
      },
      paymentMethod: "ONLINE_RAZORPAY",
      paymentStatus: "COMPLETED",
      orderStatus: "DELIVERED"
    });

    // Create published review by author
    testReview = await Review.create({
      productId: testProduct._id,
      userId: authorUser._id,
      orderId: testOrder._id,
      orderItemId: testOrderItemId,
      rating: 5,
      title: "Helpful Test Review",
      comment: "This is a detailed, well-written review that deserves helpful votes.",
      isVerifiedPurchase: true,
      status: "PUBLISHED"
    });

    // Create hidden review
    hiddenReview = await Review.create({
      productId: testProduct._id,
      userId: authorUser._id,
      orderId: testOrder._id,
      orderItemId: new mongoose.Types.ObjectId(),
      rating: 4,
      title: "Hidden Helpful Review",
      comment: "This review is hidden by moderators.",
      isVerifiedPurchase: true,
      status: "HIDDEN"
    });
  });

  afterAll(async () => {
    if (testReview) await Review.deleteMany({ _id: { $in: [testReview._id, hiddenReview._id] } });
    if (testOrder) await Order.deleteOne({ _id: testOrder._id });
    if (testProduct) await Product.deleteOne({ _id: testProduct._id });
    await User.deleteMany({
      email: { $in: ["helpful.author@example.com", "helpful.voter1@example.com", "helpful.voter2@example.com"] }
    });
  });

  it("1. Unauthenticated customer cannot vote helpful (fails with 401)", async () => {
    const res = await request(app).post(`/api/v1/reviews/${testReview._id}/helpful`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("2. Non-existent review cannot be voted on (fails with 404)", async () => {
    const randomId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/v1/reviews/${randomId}/helpful`)
      .set("Cookie", voter1Cookie);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("3. Hidden review cannot be voted on (fails with 404 or 400)", async () => {
    const res = await request(app)
      .post(`/api/v1/reviews/${hiddenReview._id}/helpful`)
      .set("Cookie", voter1Cookie);
    expect([400, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it("4. Review author cannot vote on their own review (fails with 400)", async () => {
    const res = await request(app)
      .post(`/api/v1/reviews/${testReview._id}/helpful`)
      .set("Cookie", authorCookie);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot vote on your own review/i);
  });

  it("5. Authenticated customer can successfully vote helpful once (succeeds with 200)", async () => {
    const res = await request(app)
      .post(`/api/v1/reviews/${testReview._id}/helpful`)
      .set("Cookie", voter1Cookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.helpfulCount).toBe(1);
    expect(res.body.data.hasVotedHelpful).toBe(true);
  });

  it("6. Second vote by same user is rejected and does not double-count (fails with 400)", async () => {
    const res = await request(app)
      .post(`/api/v1/reviews/${testReview._id}/helpful`)
      .set("Cookie", voter1Cookie);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already voted/i);
  });

  it("7. Another authenticated customer can vote, incrementing helpfulCount to 2", async () => {
    const res = await request(app)
      .post(`/api/v1/reviews/${testReview._id}/helpful`)
      .set("Cookie", voter2Cookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.helpfulCount).toBe(2);
    expect(res.body.data.hasVotedHelpful).toBe(true);
  });

  it("8. Public product reviews endpoint exposes helpfulCount in review response", async () => {
    const res = await request(app).get(`/api/v1/products/${testProduct._id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const found = res.body.data.reviews.find((r) => r._id.toString() === testReview._id.toString());
    expect(found).toBeDefined();
    expect(found.helpfulCount).toBe(2);
  });
});
