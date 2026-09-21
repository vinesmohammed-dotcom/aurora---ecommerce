const Brand = require("./brand.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class BrandService {
  /**
   * Fetch all active brands for public customer storefront
   */
  static async getActiveBrands() {
    return Brand.find({ isActive: true }).sort({ name: 1 });
  }

  /**
   * Fetch paginated brands for admin dashboard
   */
  static async getAdminBrands({ page = 1, limit = 10, search, isActive } = {}) {
    const query = {};

    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: "i" };
    }

    if (isActive !== undefined && isActive !== "") {
      query.isActive = isActive === true || isActive === "true";
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [brands, total] = await Promise.all([
      Brand.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Brand.countDocuments(query)
    ]);

    return {
      brands,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
        hasNextPage: safePage * safeLimit < total,
        hasPrevPage: safePage > 1
      }
    };
  }

  /**
   * Get single brand by ID
   */
  static async getBrandById(id) {
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new AppError("Brand not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return brand;
  }

  /**
   * Create new brand (Admin)
   */
  static async createBrand({ name, slug, logoUrl, description, isActive = true }) {
    const normalizedName = name.trim();
    const generatedSlug = slug
      ? slug.trim().toLowerCase()
      : normalizedName
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "");

    const existingName = await Brand.findOne({
      name: { $regex: `^${normalizedName}$`, $options: "i" }
    });
    if (existingName) {
      throw new AppError(
        "A brand with this name already exists.",
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }

    const existingSlug = await Brand.findOne({ slug: generatedSlug });
    if (existingSlug) {
      throw new AppError(
        "A brand with this slug already exists.",
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }

    return Brand.create({
      name: normalizedName,
      slug: generatedSlug,
      logoUrl: logoUrl ? logoUrl.trim() : "",
      description: description ? description.trim() : "",
      isActive
    });
  }

  /**
   * Update brand by ID (Admin)
   */
  static async updateBrand(id, updateData) {
    const brand = await this.getBrandById(id);

    if (updateData.name && updateData.name.trim().toLowerCase() !== brand.name.toLowerCase()) {
      const duplicate = await Brand.findOne({
        _id: { $ne: id },
        name: { $regex: `^${updateData.name.trim()}$`, $options: "i" }
      });
      if (duplicate) {
        throw new AppError(
          "A brand with this name already exists.",
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }
      brand.name = updateData.name.trim();
    }

    if (updateData.slug && updateData.slug.trim().toLowerCase() !== brand.slug) {
      const duplicateSlug = await Brand.findOne({
        _id: { $ne: id },
        slug: updateData.slug.trim().toLowerCase()
      });
      if (duplicateSlug) {
        throw new AppError(
          "A brand with this slug already exists.",
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }
      brand.slug = updateData.slug.trim().toLowerCase();
    }

    if (updateData.logoUrl !== undefined) {
      brand.logoUrl = updateData.logoUrl.trim();
    }

    if (updateData.description !== undefined) {
      brand.description = updateData.description.trim();
    }

    if (updateData.isActive !== undefined) {
      brand.isActive = updateData.isActive;
    }

    return brand.save();
  }

  /**
   * Toggle active status of brand (Admin)
   */
  static async setBrandStatus(id, isActive) {
    const brand = await this.getBrandById(id);
    brand.isActive = isActive;
    return brand.save();
  }

  /**
   * Safe delete or toggle deactivation of brand (Admin)
   */
  static async deleteBrand(id) {
    const brand = await this.getBrandById(id);

    // Check if any product references this brand
    const Product = require("../products/product.model");
    const referencingProducts = await Product.countDocuments({ brand: id });

    if (referencingProducts > 0) {
      brand.isActive = false;
      await brand.save();
      return {
        brand,
        deactivated: true,
        message: `Brand deactivated because ${referencingProducts} products still reference it.`
      };
    }

    await Brand.findByIdAndDelete(id);
    return {
      brand,
      deactivated: false,
      message: "Brand deleted successfully."
    };
  }
}

module.exports = BrandService;
