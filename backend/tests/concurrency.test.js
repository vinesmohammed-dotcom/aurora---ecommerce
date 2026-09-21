import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import env from "../src/config/env";
import Product from "../src/modules/products/product.model";
import Category from "../src/modules/categories/category.model";
import Brand from "../src/modules/brands/brand.model";
import StockService from "../src/modules/products/stock.service";

describe("Phase 4 — Stock Concurrency & Atomic Race Condition Safeguards", () => {
  let testProductId;
  let limitedVariantId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    await Product.deleteMany({ slug: "flash-sale-sneaker" });
    await Category.deleteMany({ slug: "flash-sale-category" });
    await Brand.deleteMany({ slug: "flash-sale-brand" });

    const cat = await Category.create({ name: "Flash Sale Category", slug: "flash-sale-category", isActive: true });
    const brand = await Brand.create({ name: "Flash Sale Brand", slug: "flash-sale-brand", isActive: true });

    // Seed product with EXACTLY 1 item in stock
    const product = await Product.create({
      name: "Flash Sale Sneaker",
      slug: "flash-sale-sneaker",
      description: "Ultra-limited sneaker with only 1 item in warehouse.",
      category: cat._id,
      brand: brand._id,
      isActive: true,
      variants: [
        {
          sku: "FLASH-LIMITED-01",
          price: 25000,
          costPrice: 15000,
          stock: 1, // EXACTLY 1 UNIT IN STOCK
          isActive: true
        }
      ]
    });

    testProductId = product._id;
    limitedVariantId = product.variants[0]._id;
  });

  afterAll(async () => {
    await Product.deleteMany({ slug: "flash-sale-sneaker" });
    await Category.deleteMany({ slug: "flash-sale-category" });
    await Brand.deleteMany({ slug: "flash-sale-brand" });
  });

  it("ATOMIC CONCURRENCY GUARANTEE: Exactly one of two simultaneous purchase attempts succeeds when stock is 1", async () => {
    // Both Customer A and Customer B attempt to purchase 1 unit at the exact same instant
    const attemptA = StockService.decrementVariantStock({
      productId: testProductId,
      variantId: limitedVariantId,
      quantity: 1
    });

    const attemptB = StockService.decrementVariantStock({
      productId: testProductId,
      variantId: limitedVariantId,
      quantity: 1
    });

    // Fire concurrently using Promise.all
    const [resultA, resultB] = await Promise.all([attemptA, attemptB]);

    // One must succeed (true) and the other must fail (false)
    const successCount = [resultA, resultB].filter((res) => res === true).length;
    const failureCount = [resultA, resultB].filter((res) => res === false).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // Verify database stock state is 0 and NEVER drops below 0 (no overselling)
    const refreshedProduct = await Product.findById(testProductId);
    const variant = refreshedProduct.variants.id(limitedVariantId);
    expect(variant.stock).toBe(0);
  });

  it("Subsequent purchase attempt after stock reaches 0 must safely fail", async () => {
    const thirdAttempt = await StockService.decrementVariantStock({
      productId: testProductId,
      variantId: limitedVariantId,
      quantity: 1
    });

    expect(thirdAttempt).toBe(false);

    // Stock remains 0
    const refreshedProduct = await Product.findById(testProductId);
    const variant = refreshedProduct.variants.id(limitedVariantId);
    expect(variant.stock).toBe(0);
  });
});
