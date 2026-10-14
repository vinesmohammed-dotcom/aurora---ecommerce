import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import User from "../src/modules/users/user.model";
import Category from "../src/modules/categories/category.model";
import Brand from "../src/modules/brands/brand.model";
import Product from "../src/modules/products/product.model";

describe("Phase 3 — Product Catalog & Variants (Integration Tests)", () => {
  let adminCookie = "";
  let userCookie = "";
  let activeCategoryId = "";
  let inactiveCategoryId = "";
  let activeBrandId = "";
  let inactiveBrandId = "";
  let createdProductId = "";
  let createdVariantId = "";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    // Clean up
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: { $in: ["prod.admin@example.com", "prod.user@example.com"] } });

    // Seed Admin & User
    await User.create({
      name: "Product Admin",
      email: "prod.admin@example.com",
      passwordHash: await User.hashPassword("AdminPass123!"),
      role: "ADMIN",
      isVerified: true
    });

    await User.create({
      name: "Product User",
      email: "prod.user@example.com",
      passwordHash: await User.hashPassword("UserPass123!"),
      role: "USER",
      isVerified: true
    });

    // Logins
    const adminLogin = await request(app).post("/api/v1/auth/login").send({
      email: "prod.admin@example.com",
      password: "AdminPass123!"
    });
    adminCookie = adminLogin.headers["set-cookie"][0];

    const userLogin = await request(app).post("/api/v1/auth/login").send({
      email: "prod.user@example.com",
      password: "UserPass123!"
    });
    userCookie = userLogin.headers["set-cookie"][0];

    // Seed Categories & Brands
    const catActive = await Category.create({ name: "Running Shoes", slug: "running-shoes", isActive: true });
    activeCategoryId = catActive._id.toString();

    const catInactive = await Category.create({ name: "Archived Gear", slug: "archived-gear", isActive: false });
    inactiveCategoryId = catInactive._id.toString();

    const brandActive = await Brand.create({ name: "Nike Running", slug: "nike-running", isActive: true });
    activeBrandId = brandActive._id.toString();

    const brandInactive = await Brand.create({ name: "Old Brand", slug: "old-brand", isActive: false });
    inactiveBrandId = brandInactive._id.toString();
  });

  afterAll(async () => {
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await User.deleteMany({ email: { $in: ["prod.admin@example.com", "prod.user@example.com"] } });
  });

  // ============================================================================
  // 1. ADMIN PRODUCT CREATION & VALIDATION
  // ============================================================================
  describe("Admin Product Creation & Business Rules", () => {
    it("should allow admin to create a valid product with embedded variants", async () => {
      const res = await request(app)
        .post("/api/v1/admin/products")
        .set("Cookie", adminCookie)
        .send({
          name: "Nike Air Zoom Pegasus 40",
          description: "High-performance daily trainer with responsive cushioning and engineered mesh.",
          category: activeCategoryId,
          brand: activeBrandId,
          images: ["https://images.example.com/pegasus-1.jpg"],
          tags: ["marathon", "responsive", "cushion"],
          isActive: true,
          variants: [
            {
              sku: "PEG-BLK-42",
              attributes: { color: "Black", size: "42" },
              price: 9999,
              costPrice: 5500,
              stock: 15,
              isActive: true
            },
            {
              sku: "PEG-WHT-43",
              attributes: { color: "White", size: "43" },
              price: 10499,
              costPrice: 5800,
              stock: 8,
              isActive: true
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Nike Air Zoom Pegasus 40");
      expect(res.body.data.slug).toBe("nike-air-zoom-pegasus-40");
      expect(res.body.data.variants.length).toBe(2);
      expect(res.body.data.basePrice).toBe(9999); // Auto-computed lowest active price

      createdProductId = res.body.data._id;
      createdVariantId = res.body.data.variants[0]._id;
    });

    it("should reject product creation if category is inactive", async () => {
      const res = await request(app)
        .post("/api/v1/admin/products")
        .set("Cookie", adminCookie)
        .send({
          name: "Invalid Category Shoe",
          description: "Testing inactive category rejection rule.",
          category: inactiveCategoryId,
          brand: activeBrandId,
          variants: [
            {
              sku: "INV-CAT-01",
              price: 2000,
              costPrice: 1000,
              stock: 5
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("inactive category");
    });

    it("should reject product creation if brand is inactive", async () => {
      const res = await request(app)
        .post("/api/v1/admin/products")
        .set("Cookie", adminCookie)
        .send({
          name: "Invalid Brand Shoe",
          description: "Testing inactive brand rejection rule.",
          category: activeCategoryId,
          brand: inactiveBrandId,
          variants: [
            {
              sku: "INV-BRD-01",
              price: 2000,
              costPrice: 1000,
              stock: 5
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("inactive brand");
    });

    it("should reject product creation with duplicate variant SKU within the same product", async () => {
      const res = await request(app)
        .post("/api/v1/admin/products")
        .set("Cookie", adminCookie)
        .send({
          name: "Duplicate SKU Product",
          description: "Testing duplicate SKU rejection within payload.",
          category: activeCategoryId,
          brand: activeBrandId,
          variants: [
            { sku: "SAME-SKU-01", price: 1000, costPrice: 500, stock: 5 },
            { sku: "SAME-SKU-01", price: 1200, costPrice: 600, stock: 3 }
          ]
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Duplicate SKU");
    });

    it("should reject product creation if variant SKU already exists in another product in catalog", async () => {
      const res = await request(app)
        .post("/api/v1/admin/products")
        .set("Cookie", adminCookie)
        .send({
          name: "Clashing SKU Product",
          description: "Testing cross-product catalog SKU uniqueness.",
          category: activeCategoryId,
          brand: activeBrandId,
          variants: [
            { sku: "PEG-BLK-42", price: 8000, costPrice: 4000, stock: 2 } // Already taken by Pegasus
          ]
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already exists in the catalog");
    });

    it("should reject product creation with negative price, costPrice, or stock via Zod", async () => {
      const res = await request(app)
        .post("/api/v1/admin/products")
        .set("Cookie", adminCookie)
        .send({
          name: "Negative Value Shoe",
          description: "Testing validation on prices and stock.",
          category: activeCategoryId,
          brand: activeBrandId,
          variants: [
            { sku: "NEG-01", price: -50, costPrice: -10, stock: -5 }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject activating a product that has zero active variants", async () => {
      const res = await request(app)
        .post("/api/v1/admin/products")
        .set("Cookie", adminCookie)
        .send({
          name: "Inactive Variants Product",
          description: "Product marked active but all variants inactive.",
          category: activeCategoryId,
          brand: activeBrandId,
          isActive: true,
          variants: [
            { sku: "INACT-01", price: 1000, costPrice: 500, stock: 5, isActive: false }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("at least one active variant");
    });
  });

  // ============================================================================
  // 2. EMBEDDED VARIANT MANAGEMENT
  // ============================================================================
  describe("Admin Embedded Variant Operations", () => {
    it("should allow admin to update a single embedded variant and recompute basePrice", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/products/${createdProductId}/variants/${createdVariantId}`)
        .set("Cookie", adminCookie)
        .send({
          price: 8999, // Lowered from 9999
          stock: 20
        });

      expect(res.status).toBe(200);
      const updatedVariant = res.body.data.variants.find((v) => v._id === createdVariantId);
      expect(updatedVariant.price).toBe(8999);
      expect(updatedVariant.stock).toBe(20);
      expect(res.body.data.basePrice).toBe(8999);
    });

    it("should allow admin to add a third variant to the product", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/products/${createdProductId}/variants`)
        .set("Cookie", adminCookie)
        .send({
          sku: "PEG-BLU-44",
          attributes: { color: "Blue", size: "44" },
          price: 11000,
          costPrice: 6000,
          stock: 4,
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.data.variants.length).toBe(3);
    });

    it("should reject adding a variant with duplicate SKU within the same product", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/products/${createdProductId}/variants`)
        .set("Cookie", adminCookie)
        .send({
          sku: "PEG-BLK-42", // Already exists in this product
          attributes: { color: "Black", size: "42" },
          price: 9999,
          costPrice: 5000,
          stock: 5,
          isActive: true
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Duplicate SKU");
    });

    it("should reject updating a variant to another existing variant's SKU in the same product", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/products/${createdProductId}/variants/${createdVariantId}`)
        .set("Cookie", adminCookie)
        .send({
          sku: "PEG-BLU-44" // Already belongs to the 3rd variant
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("Duplicate SKU");
    });
  });

  // ============================================================================
  // 3. PUBLIC CATALOG BROWSING & DATA CONCEALMENT (COSTPRICE)
  // ============================================================================
  describe("Public Catalog Queries & Security", () => {
    beforeAll(async () => {
      // Seed additional active and inactive products
      await Product.create({
        name: "Budget Running Sneaker",
        slug: "budget-running-sneaker",
        description: "Affordable running shoe for casual joggers.",
        category: activeCategoryId,
        brand: activeBrandId,
        basePrice: 2499,
        isActive: true,
        variants: [
          { sku: "BDG-01", price: 2499, costPrice: 1200, stock: 50, isActive: true }
        ]
      });

      await Product.create({
        name: "Secret Unreleased Shoe",
        slug: "secret-unreleased-shoe",
        description: "Prototype shoe not yet available to the public.",
        category: activeCategoryId,
        brand: activeBrandId,
        basePrice: 15000,
        isActive: false, // Inactive product
        variants: [
          { sku: "SEC-01", price: 15000, costPrice: 7000, stock: 5, isActive: true }
        ]
      });
    });

    it("GET /api/v1/products should return active products and paginate properly", async () => {
      const res = await request(app).get("/api/v1/products?page=1&limit=10");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.total).toBe(2); // Pegasus + Budget, NOT Secret

      const slugs = res.body.data.map((p) => p.slug);
      expect(slugs).toContain("nike-air-zoom-pegasus-40");
      expect(slugs).toContain("budget-running-sneaker");
      expect(slugs).not.toContain("secret-unreleased-shoe"); // Inactive hidden!
    });

    it("CRITICAL SECURITY: GET /api/v1/products must NEVER expose costPrice to customers", async () => {
      const res = await request(app).get("/api/v1/products");

      expect(res.status).toBe(200);
      for (const product of res.body.data) {
        for (const variant of product.variants) {
          expect(variant.costPrice).toBeUndefined();
        }
      }
    });

    it("CRITICAL SECURITY: GET /api/v1/products/:slug must NEVER expose costPrice to customers", async () => {
      const res = await request(app).get("/api/v1/products/nike-air-zoom-pegasus-40");

      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe("nike-air-zoom-pegasus-40");
      for (const variant of res.body.data.variants) {
        expect(variant.costPrice).toBeUndefined();
      }
    });

    it("ADMIN ENDPOINT: GET /api/v1/admin/products/:id SHOULD expose costPrice to admin", async () => {
      const res = await request(app)
        .get(`/api/v1/admin/products/${createdProductId}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      const pegVariant = res.body.data.variants[0];
      expect(pegVariant.costPrice).toBeDefined();
      expect(pegVariant.costPrice).toBeGreaterThan(0);
    });

    it("should filter products by price range (minPrice, maxPrice)", async () => {
      const res = await request(app).get("/api/v1/products?minPrice=2000&maxPrice=5000");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe("budget-running-sneaker");
    });

    it("should sort products by price ascending (price_asc)", async () => {
      const res = await request(app).get("/api/v1/products?sort=price_asc");

      expect(res.status).toBe(200);
      expect(res.body.data[0].basePrice).toBeLessThanOrEqual(res.body.data[1].basePrice);
      expect(res.body.data[0].slug).toBe("budget-running-sneaker");
    });

    it("should search products by product name", async () => {
      const res = await request(app).get("/api/v1/products?search=Pegasus");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe("nike-air-zoom-pegasus-40");
    });

    it("should search products by description", async () => {
      const res = await request(app).get("/api/v1/products?search=cushioning");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe("nike-air-zoom-pegasus-40");
    });

    it("should search products by tags", async () => {
      const res = await request(app).get("/api/v1/products?search=marathon");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe("nike-air-zoom-pegasus-40");
    });

    it("should return empty results when search keyword is irrelevant", async () => {
      const res = await request(app).get("/api/v1/products?search=microwave-oven-xyz");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    it("should reject non-admin users from accessing admin product endpoints with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/products")
        .set("Cookie", userCookie);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("should allow admin to adjust variant inventory stock with reason and audit tracking", async () => {
      const adjustRes = await request(app)
        .patch("/api/v1/admin/products/inventory/adjust")
        .set("Cookie", adminCookie)
        .send({
          productId: createdProductId,
          variantId: createdVariantId,
          adjustmentType: "INCREMENT",
          quantity: 15,
          reason: "RESTOCK",
          notes: "Inbound warehouse delivery PO-102"
        });

      expect(adjustRes.status).toBe(200);
      expect(adjustRes.body.success).toBe(true);
      expect(adjustRes.body.data.newStock).toBe(35); // 20 initial + 15
    });

    it("should reject inventory adjustment that would cause negative stock", async () => {
      const failRes = await request(app)
        .patch("/api/v1/admin/products/inventory/adjust")
        .set("Cookie", adminCookie)
        .send({
          productId: createdProductId,
          variantId: createdVariantId,
          adjustmentType: "DECREMENT",
          quantity: 9999,
          reason: "DAMAGED_DISPOSAL"
        });

      expect(failRes.status).toBe(400);
      expect(failRes.body.message).toMatch(/cannot decrement stock below zero/i);
    });

    it("should allow admin to bulk toggle active status of products", async () => {
      const bulkRes = await request(app)
        .patch("/api/v1/admin/products/bulk-status")
        .set("Cookie", adminCookie)
        .send({
          productIds: [createdProductId],
          isActive: false
        });

      expect(bulkRes.status).toBe(200);
      expect(bulkRes.body.success).toBe(true);
      expect(bulkRes.body.data.modifiedCount).toBe(1);

      // Re-activate
      await request(app)
        .patch("/api/v1/admin/products/bulk-status")
        .set("Cookie", adminCookie)
        .send({
          productIds: [createdProductId],
          isActive: true
        });
    });

    it("should allow admin to export catalog products as CSV", async () => {
      const csvRes = await request(app)
        .get("/api/v1/admin/products/export/csv")
        .set("Cookie", adminCookie);

      expect(csvRes.status).toBe(200);
      expect(csvRes.headers["content-type"]).toContain("text/csv");
      expect(csvRes.text).toContain("Product Name");
      expect(csvRes.text).toContain("SKU");
      expect(csvRes.text).toContain("Selling Price (INR)");
    });
  });
});
