const Category = require("./category.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class CategoryService {
  /**
   * Fetch all active categories for public customer storefront
   */
  static async getActiveCategories() {
    return Category.find({ isActive: true }).sort({ name: 1 });
  }

  /**
   * Fetch paginated categories for admin management
   */
  static async getAdminCategories({ page = 1, limit = 10, search, isActive } = {}) {
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

    const [categories, total] = await Promise.all([
      Category.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Category.countDocuments(query)
    ]);

    return {
      categories,
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
   * Get single category by ID
   */
  static async getCategoryById(id) {
    const category = await Category.findById(id);
    if (!category) {
      throw new AppError("Category not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return category;
  }

  /**
   * Create new category (Admin)
   */
  static async createCategory({ name, slug, description, isActive = true }) {
    const normalizedName = name.trim();
    const generatedSlug = slug
      ? slug.trim().toLowerCase()
      : normalizedName
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "");

    const existingName = await Category.findOne({
      name: { $regex: `^${normalizedName}$`, $options: "i" }
    });
    if (existingName) {
      throw new AppError(
        "A category with this name already exists.",
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }

    const existingSlug = await Category.findOne({ slug: generatedSlug });
    if (existingSlug) {
      throw new AppError(
        "A category with this slug already exists.",
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }

    return Category.create({
      name: normalizedName,
      slug: generatedSlug,
      description: description ? description.trim() : "",
      isActive
    });
  }

  /**
   * Update category by ID (Admin)
   */
  static async updateCategory(id, updateData) {
    const category = await this.getCategoryById(id);

    if (updateData.name && updateData.name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const duplicate = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: `^${updateData.name.trim()}$`, $options: "i" }
      });
      if (duplicate) {
        throw new AppError(
          "A category with this name already exists.",
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }
      category.name = updateData.name.trim();
    }

    if (updateData.slug && updateData.slug.trim().toLowerCase() !== category.slug) {
      const duplicateSlug = await Category.findOne({
        _id: { $ne: id },
        slug: updateData.slug.trim().toLowerCase()
      });
      if (duplicateSlug) {
        throw new AppError(
          "A category with this slug already exists.",
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }
      category.slug = updateData.slug.trim().toLowerCase();
    }

    if (updateData.description !== undefined) {
      category.description = updateData.description.trim();
    }

    if (updateData.isActive !== undefined) {
      category.isActive = updateData.isActive;
    }

    return category.save();
  }

  /**
   * Safe delete or toggle deactivation of category (Admin)
   */
  static async deleteCategory(id) {
    const category = await this.getCategoryById(id);

    // Check if any product references this category
    const Product = require("../products/product.model");
    const referencingProducts = await Product.countDocuments({ category: id });

    if (referencingProducts > 0) {
      // Deactivate safely rather than breaking product references
      category.isActive = false;
      await category.save();
      return {
        category,
        deactivated: true,
        message: `Category deactivated because ${referencingProducts} products still reference it.`
      };
    }

    await Category.findByIdAndDelete(id);
    return {
      category,
      deactivated: false,
      message: "Category deleted successfully."
    };
  }
}

module.exports = CategoryService;
