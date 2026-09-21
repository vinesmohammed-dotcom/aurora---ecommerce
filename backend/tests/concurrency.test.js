import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import env from "../src/config/env";
import Product from "../src/modules/products/product.model";
import Category from "../src/modules/categories/category.model";
import Brand from "../src/modules/brands/brand.model";
import StockService from "../src/modules/products/stock.service";

describe("Phase 4 & 5 — Stock Concurrency & Atomic Race Condition Safeguards", () => {
  let testProductId;
  let limitedVariantId;
  let multiVariantProductId;
  let variantAId;
  let variantBId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    await Product.deleteMany({ slug: { $in: ["flash-sale-sneaker", "multi-variant-shoe"] } });
    await Category.deleteMany({ slug: "flash-sale-category" });
    await Brand.deleteMany({ slug: "flash-sale-brand" });

    const cat = await Category.create({ name: "Flash Sale Category", slug: "flash-sale-category", isActive: true });
    const brand = await Brand.create({ name: "Flash Sale Brand", slug: "flash-sale-brand", isActive: true });

    // 1. Seed product with EXACTLY 1 item in stock for race test
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

    // 2. Seed multi-variant product: Variant A has 0 stock, Variant B has 5 stock
    const multiProd = await Product.create({
      name: "Multi Variant Shoe",
      slug: "multi-variant-shoe",
      description: "Shoe with multiple variants to test $elemMatch condition isolation.",
      category: cat._id,
      brand: brand._id,
      isActive: true,
      variants: [
        {
          sku: "MULTI-VAR-A",
          price: 12000,
          costPrice: 8000,
          stock: 0, // Out of stock
          isActive: true
        },
        {
          sku: "MULTI-VAR-B",
          price: 12000,
          costPrice: 8000,
          stock: 5, // In stock
          isActive: true
        }
      ]
    });

    multiVariantProductId = multiProd._id;
    variantAId = multiProd.variants[0]._id;
    variantBId = multiProd.variants[1]._id;
  });

  afterAll(async () => {
    await Product.deleteMany({ slug: { $in: ["flash-sale-sneaker", "multi-variant-shoe"] } });
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

  it("CRITICAL $elemMatch ISOLATION: Sufficient stock in Variant B must NOT satisfy Variant A purchase when Variant A has 0 stock", async () => {
    // Attempt to decrement Variant A (stock = 0) on a product where Variant B has stock = 5
    const attemptA = await StockService.decrementVariantStock({
      productId: multiVariantProductId,
      variantId: variantAId,
      quantity: 1
    });

    // Must strictly fail!
    expect(attemptA).toBe(false);

    // Verify neither variant had its stock corrupted
    const refreshed = await Product.findById(multiVariantProductId);
    const vA = refreshed.variants.id(variantAId);
    const vB = refreshed.variants.id(variantBId);

    expect(vA.stock).toBe(0);
    expect(vB.stock).toBe(5); // Variant B remains untouched!
  });

  it("Atomic stock restoration: Restores exact variant stock when cancelled", async () => {
    const restored = await StockService.restoreVariantStock({
      productId: testProductId,
      variantId: limitedVariantId,
      quantity: 1
    });

    expect(restored).toBe(true);

    const refreshedProduct = await Product.findById(testProductId);
    const variant = refreshedProduct.variants.id(limitedVariantId);
    expect(variant.stock).toBe(1);
  });
});
