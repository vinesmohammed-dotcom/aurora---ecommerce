import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import env from "../src/config/env";
import User from "../src/modules/users/user.model";
import Category from "../src/modules/categories/category.model";
import Brand from "../src/modules/brands/brand.model";
import Product from "../src/modules/products/product.model";
import Offer from "../src/modules/offers/offer.model";
import OfferService from "../src/modules/offers/offer.service";

describe("Phase 5 — Promotional Offers & Non-Stacking Deterministic Resolution (Integration Tests)", () => {
  let adminCookie;
  let userCookie;
  let categoryId;
  let productId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    await Offer.syncIndexes();
    await Offer.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: { $in: ["admin.offers@example.com", "user.offers@example.com"] } });

    // Seed Admin
    const adminPass = await User.hashPassword("AdminPass123!");
    await User.create({
      name: "Offer Admin",
      email: "admin.offers@example.com",
      passwordHash: adminPass,
      role: "ADMIN",
      isVerified: true
    });

    const adminAuthRes = await request(app).post("/api/v1/auth/login").send({
      email: "admin.offers@example.com",
      password: "AdminPass123!"
    });
    adminCookie = adminAuthRes.headers["set-cookie"][0];

    // Seed Customer
    const userPass = await User.hashPassword("UserPass123!");
    await User.create({
      name: "Offer User",
      email: "user.offers@example.com",
      passwordHash: userPass,
      role: "USER",
      isVerified: true
    });

    const userAuthRes = await request(app).post("/api/v1/auth/login").send({
      email: "user.offers@example.com",
      password: "UserPass123!"
    });
    userCookie = userAuthRes.headers["set-cookie"][0];

    // Seed Category, Brand, Product
    const cat = await Category.create({ name: "Electronics", slug: "electronics", isActive: true });
    categoryId = cat._id.toString();

    const brand = await Brand.create({ name: "Sony", slug: "sony", isActive: true });

    const prod = await Product.create({
      name: "Noise-Cancelling Headphones",
      slug: "noise-cancelling-headphones",
      description: "Premium wireless headphones.",
      category: categoryId,
      brand: brand._id,
      isActive: true,
      variants: [{ sku: "SONY-WH-1000", price: 20000, costPrice: 12000, stock: 10, isActive: true }]
    });
    productId = prod._id.toString();
  });

  afterAll(async () => {
    await Offer.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: { $in: ["admin.offers@example.com", "user.offers@example.com"] } });
  });

  describe("Admin Offer Management & RBAC", () => {
    let createdOfferId;

    it("Admin can create a category-level percentage offer", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);

      const res = await request(app)
        .post("/api/v1/admin/offers")
        .set("Cookie", adminCookie)
        .send({
          name: "Electronics Mega Fest",
          targetType: "CATEGORY",
          category: categoryId,
          discountPercentage: 10,
          endDate: tomorrow.toISOString(),
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.offer.discountPercentage).toBe(10);
      createdOfferId = res.body.data.offer._id;
    });

    it("Regular customer cannot create offers (403 Forbidden)", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);

      const res = await request(app)
        .post("/api/v1/admin/offers")
        .set("Cookie", userCookie)
        .send({
          name: "Unauthorized Offer",
          targetType: "CATEGORY",
          category: categoryId,
          discountPercentage: 20,
          endDate: tomorrow.toISOString()
        });

      expect(res.status).toBe(403);
    });

    it("Admin can update an existing offer", async () => {
      const res = await request(app)
        .put(`/api/v1/admin/offers/${createdOfferId}`)
        .set("Cookie", adminCookie)
        .send({
          discountPercentage: 15
        });

      expect(res.status).toBe(200);
      expect(res.body.data.offer.discountPercentage).toBe(15);
    });
  });

  describe("Deterministic Offer Resolution Engine (Non-Stacking)", () => {
    it("CRITICAL: When product has both Category (15%) and Product (25%) offers, the LARGER discount wins", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);

      // Create 25% Product Offer
      await Offer.create({
        name: "Headphones Special Deal",
        targetType: "PRODUCT",
        product: productId,
        discountPercentage: 25,
        startDate: new Date(),
        endDate: tomorrow,
        isActive: true
      });

      const best = await OfferService.resolveBestOffer({
        productId,
        categoryId
      });

      expect(best).not.toBeNull();
      // 25% > 15%, so Product offer wins
      expect(best.discountPercentage).toBe(25);
      expect(best.offer.targetType).toBe("PRODUCT");
    });

    it("CRITICAL: When Category offer (30%) exceeds Product offer (25%), Category offer wins", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);

      // Create a 30% Category Offer
      await Offer.create({
        name: "Super Electronics Bonanza",
        targetType: "CATEGORY",
        category: categoryId,
        discountPercentage: 30,
        startDate: new Date(),
        endDate: tomorrow,
        isActive: true
      });

      const best = await OfferService.resolveBestOffer({
        productId,
        categoryId
      });

      expect(best).not.toBeNull();
      // 30% > 25%, Category offer wins!
      expect(best.discountPercentage).toBe(30);
      expect(best.offer.targetType).toBe("CATEGORY");
    });

    it("Expired or inactive offers are strictly ignored", async () => {
      await Offer.deleteMany({});

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const pastStart = new Date();
      pastStart.setDate(pastStart.getDate() - 5);

      // Expired offer
      await Offer.create({
        name: "Past Offer",
        targetType: "PRODUCT",
        product: productId,
        discountPercentage: 50,
        startDate: pastStart,
        endDate: yesterday,
        isActive: true
      });

      const best = await OfferService.resolveBestOffer({
        productId,
        categoryId
      });

      expect(best).toBeNull();
    });
  });
});
