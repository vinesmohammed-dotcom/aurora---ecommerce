const Product = require("./product.model");

class StockService {
  /**
   * Atomically decrements variant stock using document-level conditional locking.
   *
   * Condition:
   * 1. Product exists and is active
   * 2. Embedded variant exists, is active, AND currently has stock >= requested quantity
   *
   * Mutation:
   * Uses $inc to decrement stock atomically in a single database operation.
   *
   * Why this defeats race conditions:
   * In a naive "read stock -> verify >= qty -> update stock" flow, two concurrent requests
   * both read stock = 1 and both execute updates, leaving stock = -1 (overselling).
   * By embedding the condition `stock: { $gte: quantity }` directly into the write predicate,
   * MongoDB's document-level ACID lock guarantees that only the first write matches and executes.
   * The second concurrent write matches 0 documents and fails safely.
   */
  static async decrementVariantStock({ productId, variantId, quantity }) {
    const result = await Product.updateOne(
      {
        _id: productId,
        variants: {
          $elemMatch: {
            _id: variantId,
            stock: { $gte: quantity },
            isActive: true
          }
        }
      },
      {
        $inc: { "variants.$.stock": -quantity }
      }
    );

    return result.matchedCount > 0 && result.modifiedCount > 0;
  }
}

module.exports = StockService;
