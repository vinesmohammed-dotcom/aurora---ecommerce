const Offer = require("./offer.model");
const Product = require("../products/product.model");
const Category = require("../categories/category.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class OfferService {
  /**
   * Create a new promotional offer (Admin)
   */
  static async createOffer(offerData) {
    if (offerData.targetType === "PRODUCT") {
      const product = await Product.findById(offerData.product);
      if (!product) {
        throw new AppError("Target product not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
      }
    } else if (offerData.targetType === "CATEGORY") {
      const category = await Category.findById(offerData.category);
      if (!category) {
        throw new AppError("Target category not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
      }
    }

    const offer = await Offer.create(offerData);
    return offer;
  }

  /**
   * List all offers (Admin / Public)
   */
  static async getOffers(filter = {}) {
    return Offer.find(filter)
      .populate("product", "name slug")
      .populate("category", "name slug")
      .sort({ createdAt: -1 });
  }

  /**
   * Get single offer by ID
   */
  static async getOfferById(id) {
    const offer = await Offer.findById(id)
      .populate("product", "name slug")
      .populate("category", "name slug");
    if (!offer) {
      throw new AppError("Offer not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return offer;
  }

  /**
   * Update an existing offer (Admin)
   */
  static async updateOffer(id, updateData) {
    const offer = await Offer.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    })
      .populate("product", "name slug")
      .populate("category", "name slug");

    if (!offer) {
      throw new AppError("Offer not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return offer;
  }

  /**
   * Delete an offer (Admin)
   */
  static async deleteOffer(id) {
    const offer = await Offer.findByIdAndDelete(id);
    if (!offer) {
      throw new AppError("Offer not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return { message: "Offer deleted successfully." };
  }

  /**
   * Deterministic Offer Resolution Engine:
   * Checks for active Product-level offer and Category-level offer.
   * If both are present, STRICTLY selects the one with the higher discount percentage (Non-stacking).
   *
   * @param {Object} params
   * @param {string} params.productId - Product ID
   * @param {string} params.categoryId - Category ID
   * @param {Date} [params.now] - Comparison timestamp
   * @returns {Promise<{ offer: Object, discountPercentage: number } | null>}
   */
  static async resolveBestOffer({ productId, categoryId, now = new Date() }) {
    const query = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { targetType: "PRODUCT", product: productId },
        { targetType: "CATEGORY", category: categoryId }
      ]
    };

    const activeOffers = await Offer.find(query);
    if (!activeOffers.length) {
      return null;
    }

    let productOffer = null;
    let categoryOffer = null;

    for (const offer of activeOffers) {
      if (offer.targetType === "PRODUCT") {
        if (!productOffer || offer.discountPercentage > productOffer.discountPercentage) {
          productOffer = offer;
        }
      } else if (offer.targetType === "CATEGORY") {
        if (!categoryOffer || offer.discountPercentage > categoryOffer.discountPercentage) {
          categoryOffer = offer;
        }
      }
    }

    // Deterministic Rule: Non-stacking. The higher discount percentage wins.
    // If equal, product-specific offer wins because it is more targeted.
    if (productOffer && categoryOffer) {
      if (productOffer.discountPercentage >= categoryOffer.discountPercentage) {
        return {
          offer: productOffer,
          discountPercentage: productOffer.discountPercentage
        };
      } else {
        return {
          offer: categoryOffer,
          discountPercentage: categoryOffer.discountPercentage
        };
      }
    }

    const winner = productOffer || categoryOffer;
    return {
      offer: winner,
      discountPercentage: winner.discountPercentage
    };
  }
}

module.exports = OfferService;
