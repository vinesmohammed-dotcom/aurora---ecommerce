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

describe("Phase 4 — Shopping Cart, Quantity Rules & Stale Detection (Integration Tests)", () => {
  let userCookie;
  let userId;
  let activeCategoryId;
  let inactiveCategoryId;
  let activeBrandId;
  let activeProductId;
  let activeVariantId;
  let secondVariantId;
  let inactiveProductId;
  let inactiveVariantProductId;
  let inactiveVariantId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    // Clean prior test artifacts
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: "cart.tester@example.com" });

    // Seed test customer
    const passHash = await User.hashPassword("CartPass123!");
    const user = await User.create({
      name: "Cart Customer",
      email: "cart.tester@example.com",
      passwordHash: passHash,
      isVerified: true
    });
    userId = user._id.toString();

    const authRes = await request(app).post("/api/v1/auth/login").send({
      email: "cart.tester@example.com",
      password: "CartPass123!"
    });
    userCookie = authRes.headers["set-cookie"][0];

    // Seed Category & Brand
    const cat = await Category.create({ name: "Footwear", slug: "footwear", isActive: true });
    activeCategoryId = cat._id.toString();

    const inactCat = await Category.create({ name: "Discontinued", slug: "discontinued", isActive: false });
    inactiveCategoryId = inactCat._id.toString();

    const brand = await Brand.create({ name: "Nike", slug: "nike", isActive: true });
    activeBrandId = brand._id.toString();

    // 1. Active Product with 2 variants
    const activeProd = await Product.create({
      name: "Pegasus Road Runner",
      slug: "pegasus-road-runner",
      description: "Responsive cushioning for road running enthusiasts.",
      category: activeCategoryId,
      brand: activeBrandId,
      isActive: true,
      variants: [
        {
          sku: "PEG-RED-42",
          price: 9999,
          costPrice: 5000,
          stock: 5,
          isActive: true
        },
        {
          sku: "PEG-BLU-43",
          price: 10499,
          costPrice: 5500,
          stock: 12,
          isActive: true
        }
      ]
    });
    activeProductId = activeProd._id.toString();
    activeVariantId = activeProd.variants[0]._id.toString();
    secondVariantId = activeProd.variants[1]._id.toString();

    // 2. Inactive Product
    const inactProd = await Product.create({
      name: "Ghosted Sneaker",
      slug: "ghosted-sneaker",
      description: "Inactive product test item.",
      category: activeCategoryId,
      brand: activeBrandId,
      isActive: false,
      variants: [
        { sku: "GHO-01", price: 3000, costPrice: 1500, stock: 10, isActive: true }
      ]
    });
    inactiveProductId = inactProd._id.toString();

    // 3. Active Product with Inactive Variant
    const inactVarProd = await Product.create({
      name: "Trainer Hybrid",
      slug: "trainer-hybrid",
      description: "Trainer with one active and one inactive variant.",
      category: activeCategoryId,
      brand: activeBrandId,
      isActive: true,
      variants: [
        { sku: "TRN-ON", price: 4000, costPrice: 2000, stock: 10, isActive: true },
        { sku: "TRN-OFF", price: 4000, costPrice: 2000, stock: 10, isActive: false }
      ]
    });
    inactiveVariantProductId = inactVarProd._id.toString();
    inactiveVariantId = inactVarProd.variants[1]._id.toString();
  });

  afterAll(async () => {
    await Cart.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: "cart.tester@example.com" });
  });

  describe("Add to Cart & Quantity Rules", () => {
    it("should allow customer to add valid active product variant to cart", async () => {
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userCookie)
        .send({
          productId: activeProductId,
          variantId: activeVariantId,
          quantity: 2
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cart.items.length).toBe(1);
      expect(res.body.data.cart.items[0].quantity).toBe(2);
      expect(res.body.data.cart.items[0].unitPrice).toBe(9999);
      expect(res.body.data.cart.items[0].itemTotal).toBe(19998);
      expect(res.body.data.cart.subtotal).toBe(19998);
      expect(res.body.data.cart.totalItems).toBe(2);
    });

    it("should increment quantity when adding the same variant again", async () => {
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userCookie)
        .send({
          productId: activeProductId,
          variantId: activeVariantId,
          quantity: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.data.cart.items.length).toBe(1);
      expect(res.body.data.cart.items[0].quantity).toBe(3); // 2 + 1
      expect(res.body.data.cart.items[0].itemTotal).toBe(29997);
    });

    it("should reject adding more units than available in stock", async () => {
      // Stock is 5. Currently have 3 in cart. Requesting 3 more would exceed stock.
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userCookie)
        .send({
          productId: activeProductId,
          variantId: activeVariantId,
          quantity: 3
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Insufficient stock");
    });

    it("should reject adding quantity that exceeds the 10 per-item limit", async () => {
      // Add second variant (stock is 12) with quantity = 11
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userCookie)
        .send({
          productId: activeProductId,
          variantId: secondVariantId,
          quantity: 11
        });

      expect(res.status).toBe(422); // Caught by Zod validator max(10)
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject mismatched product and variant IDs (variant not in product)", async () => {
      // Passing inactiveProductId with activeVariantId
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userCookie)
        .send({
          productId: inactiveProductId,
          variantId: activeVariantId,
          quantity: 1
        });

      // Product is inactive or variant does not exist on that product
      expect([400, 404]).toContain(res.status);
    });

    it("should reject adding inactive product to cart", async () => {
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userCookie)
        .send({
          productId: inactiveProductId,
          variantId: (await Product.findById(inactiveProductId)).variants[0]._id.toString(),
          quantity: 1
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("inactive");
    });

    it("should reject adding inactive variant to cart", async () => {
      const res = await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userCookie)
        .send({
          productId: inactiveVariantProductId,
          variantId: inactiveVariantId,
          quantity: 1
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("inactive");
    });
  });

  describe("Cart Retrieval & Stale Stock Detection", () => {
    it("should retrieve cart with accurate live pricing and zero wholesale costPrice exposure", async () => {
      const res = await request(app)
        .get("/api/v1/cart")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.cart.items.length).toBe(1);
      const item = res.body.data.cart.items[0];
      expect(item.unitPrice).toBe(9999);
      expect(item.costPrice).toBeUndefined(); // Data Protection guarantee
      expect(item.staleStock).toBe(false);
      expect(item.isAvailable).toBe(true);
    });

    it("should detect stale stock when warehouse inventory drops below cart quantity", async () => {
      // Artificially drop warehouse stock of activeVariantId from 5 to 2 (while user has 3 in cart)
      await Product.updateOne(
        { _id: activeProductId, "variants._id": activeVariantId },
        { $set: { "variants.$.stock": 2 } }
      );

      const res = await request(app)
        .get("/api/v1/cart")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.cart.hasStaleItems).toBe(true);
      const staleItem = res.body.data.cart.items[0];
      expect(staleItem.staleStock).toBe(true);
      expect(staleItem.availableStock).toBe(2);
      expect(staleItem.warning).toContain("Only 2 items currently available in warehouse");

      // Restore stock for remaining tests
      await Product.updateOne(
        { _id: activeProductId, "variants._id": activeVariantId },
        { $set: { "variants.$.stock": 10 } }
      );
    });
  });

  describe("Cart Mutation & Clearing", () => {
    it("should update item quantity in cart", async () => {
      const res = await request(app)
        .patch(`/api/v1/cart/items/${activeVariantId}`)
        .set("Cookie", userCookie)
        .send({ quantity: 4 });

      expect(res.status).toBe(200);
      expect(res.body.data.cart.items[0].quantity).toBe(4);
      expect(res.body.data.cart.subtotal).toBe(39996);
    });

    it("should remove a specific variant from cart", async () => {
      const res = await request(app)
        .delete(`/api/v1/cart/items/${activeVariantId}`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.cart.items.length).toBe(0);
      expect(res.body.data.cart.subtotal).toBe(0);
    });

    it("should clear the entire cart", async () => {
      // Add an item first
      await request(app)
        .post("/api/v1/cart/items")
        .set("Cookie", userCookie)
        .send({
          productId: activeProductId,
          variantId: secondVariantId,
          quantity: 1
        });

      const clearRes = await request(app)
        .delete("/api/v1/cart")
        .set("Cookie", userCookie);

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.data.cart.items.length).toBe(0);
    });

    it("should reject unauthenticated access to cart with 401", async () => {
      const res = await request(app).get("/api/v1/cart");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });
});
