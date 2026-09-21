const Product = require("./product.model");

class StockService {
  /**
   * Atomically decrements variant stock using document-level conditional locking.
   *
   * WHY $elemMatch IS STRICTLY MANDATORY:
   * When querying an array of embedded documents in MongoDB:
   * Using separate field paths like:
   *   { "variants._id": variantId, "variants.stock": { $gte: quantity } }
   * evaluates conditions independently across ALL elements in the array!
   * If Variant A has ID `variantId` but stock = 0, and Variant B has a different ID
   * but stock = 5, the non-elemMatch query matches the document! Then, `variants.$.stock`
   * modifies whichever element matched the first criteria, resulting in silent inventory corruption!
   *
   * The `$elemMatch` operator forces MongoDB to find a SINGLE array element that satisfies
   * BOTH criteria simultaneously:
   * 1. The embedded variant's _id === variantId
   * 2. THAT SAME variant's stock >= requested quantity
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.productId
   * @param {string|mongoose.Types.ObjectId} params.variantId
   * @param {number} params.quantity
   * @param {mongoose.ClientSession} [params.session] Optional MongoDB transaction session
   * @returns {Promise<boolean>} True if stock was decremented, false otherwise
   */
  static async decrementVariantStock({ productId, variantId, quantity, session = null }) {
    const options = session ? { session } : {};

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
      },
      options
    );

    return result.matchedCount > 0 && result.modifiedCount > 0;
  }

  /**
   * Atomically restores variant stock upon order cancellation.
   * Uses $elemMatch to guarantee stock is added to the exact variant.
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.productId
   * @param {string|mongoose.Types.ObjectId} params.variantId
   * @param {number} params.quantity
   * @param {mongoose.ClientSession} [params.session] Optional MongoDB transaction session
   * @returns {Promise<boolean>} True if stock was restored, false otherwise
   */
  static async restoreVariantStock({ productId, variantId, quantity, session = null }) {
    const options = session ? { session } : {};

    const result = await Product.updateOne(
      {
        _id: productId,
        variants: {
          $elemMatch: {
            _id: variantId
          }
        }
      },
      {
        $inc: { "variants.$.stock": quantity }
      },
      options
    );

    return result.matchedCount > 0 && result.modifiedCount > 0;
  }
}

module.exports = StockService;
