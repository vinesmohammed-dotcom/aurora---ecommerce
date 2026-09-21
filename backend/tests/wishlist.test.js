import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import env from "../src/config/env";
import User from "../src/modules/users/user.model";
import Category from "../src/modules/categories/category.model";
import Brand from "../src/modules/brands/brand.model";
import Product from "../src/modules/products/product.model";
import Wishlist from "../src/modules/wishlist/wishlist.model";

describe("Phase 4 — Customer Wishlist & Set Uniqueness (Integration Tests)", () => {
  let userCookie;
  let userId;
  let activeProductId;
  let inactiveProductId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    // Clean prior test artifacts
    await Wishlist.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: "wishlist.tester@example.com" });

    // Seed test user
    const passHash = await User.hashPassword("WishPass123!");
    const user = await User.create({
      name: "Wishlist Customer",
      email: "wishlist.tester@example.com",
      passwordHash: passHash,
      isVerified: true
    });
    userId = user._id.toString();

    const authRes = await request(app).post("/api/v1/auth/login").send({
      email: "wishlist.tester@example.com",
      password: "WishPass123!"
    });
    userCookie = authRes.headers["set-cookie"][0];

    // Seed Category & Brand
    const cat = await Category.create({ name: "Athletics", slug: "athletics", isActive: true });
    const brand = await Brand.create({ name: "Adidas", slug: "adidas", isActive: true });

    // Seed Products
    const prod1 = await Product.create({
      name: "Ultraboost Light",
      slug: "ultraboost-light",
      description: "Epic energy return with lightweight boost midsole.",
      category: cat._id,
      brand: brand._id,
      isActive: true,
      variants: [{ sku: "UB-01", price: 15999, costPrice: 9000, stock: 10, isActive: true }]
    });
    activeProductId = prod1._id.toString();

    const prod2 = await Product.create({
      name: "Vintage Track Top",
      slug: "vintage-track-top",
      description: "Archival jacket now discontinued.",
      category: cat._id,
      brand: brand._id,
      isActive: false, // Inactive
      variants: [{ sku: "VT-01", price: 4999, costPrice: 2000, stock: 0, isActive: false }]
    });
    inactiveProductId = prod2._id.toString();
  });

  afterAll(async () => {
    await Wishlist.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: "wishlist.tester@example.com" });
  });

  describe("Wishlist Additions & Uniqueness Rules", () => {
    it("should allow customer to add active product to wishlist", async () => {
      const res = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Cookie", userCookie)
        .send({ productId: activeProductId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.wishlist.items.length).toBe(1);
      expect(res.body.data.wishlist.items[0]._id).toBe(activeProductId);
      expect(res.body.data.wishlist.items[0].isAvailable).toBe(true);
    });

    it("should prevent duplicate wishlist entries when adding the same product again ($addToSet)", async () => {
      const res = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Cookie", userCookie)
        .send({ productId: activeProductId });

      expect(res.status).toBe(200);
      // Length must still be 1 (no duplicates)
      expect(res.body.data.wishlist.items.length).toBe(1);
    });

    it("should retrieve populated wishlist without exposing wholesale costPrice", async () => {
      const res = await request(app)
        .get("/api/v1/wishlist")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.wishlist.items.length).toBe(1);
      const item = res.body.data.wishlist.items[0];
      expect(item.name).toBe("Ultraboost Light");
      expect(item.basePrice).toBe(15999);
      expect(item.costPrice).toBeUndefined(); // Data Protection
    });

    it("should keep inactive products visible in wishlist but flag isAvailable as false", async () => {
      // Add inactive product to wishlist
      const res = await request(app)
        .post("/api/v1/wishlist/items")
        .set("Cookie", userCookie)
        .send({ productId: inactiveProductId });

      expect(res.status).toBe(200);
      expect(res.body.data.wishlist.items.length).toBe(2);

      const inactItem = res.body.data.wishlist.items.find((i) => i._id === inactiveProductId);
      expect(inactItem.isActive).toBe(false);
      expect(inactItem.isAvailable).toBe(false); // Flagged as unavailable
    });

    it("should allow toggling a product in wishlist (remove if present)", async () => {
      const res = await request(app)
        .post("/api/v1/wishlist/toggle")
        .set("Cookie", userCookie)
        .send({ productId: activeProductId });

      expect(res.status).toBe(200);
      // Active product should have been removed
      expect(res.body.data.wishlist.items.some((i) => i._id === activeProductId)).toBe(false);
    });

    it("should remove product from wishlist via DELETE endpoint", async () => {
      const res = await request(app)
        .delete(`/api/v1/wishlist/items/${inactiveProductId}`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.wishlist.items.length).toBe(0);
    });

    it("should reject unauthenticated access to wishlist with 401", async () => {
      const res = await request(app).get("/api/v1/wishlist");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });
});
