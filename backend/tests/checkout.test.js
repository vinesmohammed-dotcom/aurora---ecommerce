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
import Offer from "../src/modules/offers/offer.model";
import Coupon from "../src/modules/coupons/coupon.model";

describe("Phase 5 — Authoritative Checkout Calculation Engine (Integration Tests)", () => {
  let userCookie;
  let userId;
  let addressId;
  let lowPriceProductId;
  let lowPriceVariantId;
  let highPriceProductId;
  let highPriceVariantId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    await Cart.syncIndexes();
    await Address.syncIndexes();
    await Coupon.syncIndexes();
    await Offer.syncIndexes();

    await Cart.deleteMany({});
    await Address.deleteMany({});
    await Coupon.deleteMany({});
    await Offer.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: "checkout.tester@example.com" });

    // Seed customer
    const userPass = await User.hashPassword("CheckoutPass123!");
    const user = await User.create({
      name: "Checkout Customer",
      email: "checkout.tester@example.com",
      passwordHash: userPass,
      isVerified: true
    });
    userId = user._id.toString();

    const authRes = await request(app).post("/api/v1/auth/login").send({
      email: "checkout.tester@example.com",
      password: "CheckoutPass123!"
    });
    userCookie = authRes.headers["set-cookie"][0];

    // Seed Address
    const addr = await Address.create({
      userId,
      fullName: "Checkout Customer",
      phone: "+91 9876543210",
      addressLine1: "123 Order Way",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "India",
      isDefault: true
    });
    addressId = addr._id.toString();

    // Seed Catalog
    const cat = await Category.create({ name: "Accessories", slug: "accessories", isActive: true });
    const brand = await Brand.create({ name: "Puma", slug: "puma", isActive: true });

    // Low price product: ₹400 (under ₹1,000 threshold)
    const lowProd = await Product.create({
      name: "Water Bottle",
      slug: "water-bottle",
      description: "Durable stainless steel bottle.",
      category: cat._id,
      brand: brand._id,
      isActive: true,
      variants: [{ sku: "BOT-01", price: 400, costPrice: 200, stock: 10, isActive: true }]
    });
    lowPriceProductId = lowProd._id.toString();
    lowPriceVariantId = lowProd.variants[0]._id.toString();

    // High price product: ₹1,500 (over ₹1,000 threshold)
    const highProd = await Product.create({
      name: "Gym Backpack",
      slug: "gym-backpack",
      description: "Spacious backpack with laptop compartment.",
      category: cat._id,
      brand: brand._id,
      isActive: true,
      variants: [{ sku: "BP-01", price: 1500, costPrice: 800, stock: 10, isActive: true }]
    });
    highPriceProductId = highProd._id.toString();
    highPriceVariantId = highProd.variants[0]._id.toString();

    // Seed a coupon
    const future = new Date();
    future.setDate(future.getDate() + 10);
    await Coupon.create({
      code: "SAVE100",
      discountType: "FLAT",
      discountValue: 100,
      minOrderValue: 300,
      expiryDate: future,
      isActive: true
    });
  });

  afterAll(async () => {
    await Cart.deleteMany({});
    await Address.deleteMany({});
    await Coupon.deleteMany({});
    await Offer.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: "checkout.tester@example.com" });
  });

  it("Rejects checkout calculation if cart is empty", async () => {
    const res = await request(app)
      .post("/api/v1/checkout/summary")
      .set("Cookie", userCookie)
      .send({ addressId });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("empty cart");
  });

  it("Applies ₹99 standard shipping when order subtotal is below ₹1,000", async () => {
    // Add low price item to cart: 1 x ₹400 = ₹400
    await request(app)
      .post("/api/v1/cart/items")
      .set("Cookie", userCookie)
      .send({ productId: lowPriceProductId, variantId: lowPriceVariantId, quantity: 1 });

    const res = await request(app)
      .post("/api/v1/checkout/summary")
      .set("Cookie", userCookie)
      .send({ addressId });

    expect(res.status).toBe(200);
    expect(res.body.data.summary.netSubtotal).toBe(400);
    expect(res.body.data.summary.shippingFee).toBe(99); // ₹99 shipping
    expect(res.body.data.summary.grandTotal).toBe(499); // 400 + 99 = 499
    expect(res.body.data.summary.qualifiesForFreeShipping).toBe(false);
  });

  it("Applies FREE shipping (₹0) when order subtotal meets or exceeds ₹1,000", async () => {
    // Add high price item: 1 x ₹1,500. Total = ₹400 + ₹1,500 = ₹1,900
    await request(app)
      .post("/api/v1/cart/items")
      .set("Cookie", userCookie)
      .send({ productId: highPriceProductId, variantId: highPriceVariantId, quantity: 1 });

    const res = await request(app)
      .post("/api/v1/checkout/summary")
      .set("Cookie", userCookie)
      .send({ addressId });

    expect(res.status).toBe(200);
    expect(res.body.data.summary.netSubtotal).toBe(1900);
    expect(res.body.data.summary.shippingFee).toBe(0); // FREE SHIPPING!
    expect(res.body.data.summary.grandTotal).toBe(1900);
    expect(res.body.data.summary.qualifiesForFreeShipping).toBe(true);
  });

  it("Calculates coupon discount and recalibrates total authoritatively", async () => {
    const res = await request(app)
      .post("/api/v1/checkout/coupon")
      .set("Cookie", userCookie)
      .send({ couponCode: "SAVE100", addressId });

    expect(res.status).toBe(200);
    expect(res.body.data.appliedCoupon.code).toBe("SAVE100");
    expect(res.body.data.summary.couponDiscount).toBe(100);
    // 1900 - 100 = 1800. Free shipping still applies (> 1000)
    expect(res.body.data.summary.grandTotal).toBe(1800);
  });
});
