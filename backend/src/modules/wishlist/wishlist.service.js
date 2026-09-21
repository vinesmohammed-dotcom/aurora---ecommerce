const Wishlist = require("./wishlist.model");
const Product = require("../products/product.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class WishlistService {
  /**
   * Get user's populated wishlist with availability statuses
   * Data Protection: wholesale costPrice is never exposed.
   */
  static async getWishlist(userId) {
    let wishlist = await Wishlist.findOne({ userId }).populate({
      path: "products",
      select: "name slug images basePrice isActive category brand variants",
      populate: [
        { path: "category", select: "name isActive" },
        { path: "brand", select: "name isActive" }
      ]
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, products: [] });
    }

    // Format products safely and detect inactive items
    const items = (wishlist.products || [])
      .filter(Boolean) // In case referenced product was deleted from DB
      .map((p) => {
        const hasStock = p.variants && p.variants.some((v) => v.isActive && v.stock > 0);
        return {
          _id: p._id,
          name: p.name,
          slug: p.slug,
          images: p.images || [],
          basePrice: p.basePrice,
          isActive: p.isActive,
          isAvailable: p.isActive && hasStock,
          category: p.category,
          brand: p.brand
        };
      });

    return {
      _id: wishlist._id,
      userId: wishlist.userId,
      items,
      count: items.length
    };
  }

  /**
   * Add product to wishlist
   * Uses $addToSet to strictly enforce uniqueness (no duplicate products)
   */
  static async addItem(userId, productId) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError("Product not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, products: [] });
    }

    await Wishlist.updateOne(
      { userId },
      { $addToSet: { products: productId } }
    );

    return this.getWishlist(userId);
  }

  /**
   * Remove product from wishlist
   */
  static async removeItem(userId, productId) {
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: productId } }
    );

    return this.getWishlist(userId);
  }

  /**
   * Toggle product in wishlist
   */
  static async toggleItem(userId, productId) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError("Product not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const wishlist = await Wishlist.findOne({ userId });
    const isPresent = wishlist && wishlist.products.some((id) => id.toString() === productId.toString());

    if (isPresent) {
      await Wishlist.updateOne({ userId }, { $pull: { products: productId } });
    } else {
      await Wishlist.updateOne(
        { userId },
        { $addToSet: { products: productId } },
        { upsert: true }
      );
    }

    return this.getWishlist(userId);
  }
}

module.exports = WishlistService;
