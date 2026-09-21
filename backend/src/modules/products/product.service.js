const mongoose = require("mongoose");
const Product = require("./product.model");
const Category = require("../categories/category.model");
const Brand = require("../brands/brand.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");
const { SORT_OPTIONS } = require("./product.validator");

class ProductService {
  /**
   * Public: Query catalog with search, filtering, sorting, and pagination
   * DATA PROTECTION: Conceals costPrice and excludes inactive variants.
   */
  static async getPublicProducts({
    page = 1,
    limit = 12,
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    inStock,
    sort = SORT_OPTIONS.NEWEST
  } = {}) {
    const query = { isActive: true };

    // 1. Text Search across name, description, and tags
    if (search && search.trim()) {
      const trimmedSearch = search.trim();
      query.$or = [
        { name: { $regex: trimmedSearch, $options: "i" } },
        { description: { $regex: trimmedSearch, $options: "i" } },
        { tags: { $regex: trimmedSearch, $options: "i" } }
      ];
    }

    // 2. Category Filter (by ObjectId or Slug)
    if (category && category.trim()) {
      if (mongoose.Types.ObjectId.isValid(category.trim())) {
        query.category = category.trim();
      } else {
        const catDoc = await Category.findOne({ slug: category.trim().toLowerCase(), isActive: true });
        if (catDoc) {
          query.category = catDoc._id;
        } else {
          // If category slug is invalid/non-existent, return empty result
          return this.emptyPaginatedResponse(page, limit);
        }
      }
    }

    // 3. Brand Filter (by ObjectId or Slug)
    if (brand && brand.trim()) {
      if (mongoose.Types.ObjectId.isValid(brand.trim())) {
        query.brand = brand.trim();
      } else {
        const brandDoc = await Brand.findOne({ slug: brand.trim().toLowerCase(), isActive: true });
        if (brandDoc) {
          query.brand = brandDoc._id;
        } else {
          return this.emptyPaginatedResponse(page, limit);
        }
      }
    }

    // 4. Price Range Filter (evaluated on product basePrice)
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.basePrice = {};
      if (minPrice !== undefined && !isNaN(Number(minPrice))) {
        query.basePrice.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
        query.basePrice.$lte = Number(maxPrice);
      }
    }

    // 5. In-Stock Filter (at least one active variant has stock > 0)
    if (inStock === "true" || inStock === true) {
      query.variants = {
        $elemMatch: {
          isActive: true,
          stock: { $gt: 0 }
        }
      };
    }

    // 6. Strict Allowlisted Sort Execution
    let sortQuery = { createdAt: -1 };
    switch (sort) {
      case SORT_OPTIONS.PRICE_ASC:
        sortQuery = { basePrice: 1, _id: 1 };
        break;
      case SORT_OPTIONS.PRICE_DESC:
        sortQuery = { basePrice: -1, _id: 1 };
        break;
      case SORT_OPTIONS.NAME_ASC:
        sortQuery = { name: 1, _id: 1 };
        break;
      case SORT_OPTIONS.NAME_DESC:
        sortQuery = { name: -1, _id: 1 };
        break;
      case SORT_OPTIONS.NEWEST:
      default:
        sortQuery = { createdAt: -1, _id: 1 };
        break;
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (safePage - 1) * safeLimit;

    // Execute query with projection concealing costPrice
    const [products, total] = await Promise.all([
      Product.find(query)
        .select("-variants.costPrice") // STOPS costPrice from leaking to customers
        .populate("brand", "name slug logoUrl")
        .populate("category", "name slug")
        .sort(sortQuery)
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Product.countDocuments(query)
    ]);

    // Filter out inactive variants from public view
    const sanitizedProducts = products.map((p) => ({
      ...p,
      variants: (p.variants || []).filter((v) => v.isActive)
    }));

    return {
      products: sanitizedProducts,
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
   * Helper for returning empty paginated result
   */
  static emptyPaginatedResponse(page, limit) {
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    return {
      products: [],
      meta: {
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
      }
    };
  }

  /**
   * Public: Get single product detail by slug
   * DATA PROTECTION: Conceals costPrice and excludes inactive variants.
   */
  static async getPublicProductBySlug(slug) {
    const product = await Product.findOne({ slug: slug.toLowerCase().trim(), isActive: true })
      .select("-variants.costPrice")
      .populate("brand", "name slug logoUrl description")
      .populate("category", "name slug description")
      .lean();

    if (!product) {
      throw new AppError("Product not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // Filter out inactive variants
    product.variants = (product.variants || []).filter((v) => v.isActive);

    if (product.variants.length === 0) {
      throw new AppError("Product is currently unavailable.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return product;
  }

  /**
   * Admin: List paginated products with full management metadata (includes costPrice)
   */
  static async getAdminProducts({
    page = 1,
    limit = 10,
    search,
    category,
    brand,
    isActive,
    sort
  } = {}) {
    const query = {};

    if (search && search.trim()) {
      const trimmed = search.trim();
      query.$or = [
        { name: { $regex: trimmed, $options: "i" } },
        { "variants.sku": { $regex: trimmed, $options: "i" } }
      ];
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    }

    if (brand && mongoose.Types.ObjectId.isValid(brand)) {
      query.brand = brand;
    }

    if (isActive !== undefined && isActive !== "") {
      query.isActive = isActive === true || isActive === "true";
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("brand", "name slug")
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      Product.countDocuments(query)
    ]);

    return {
      products,
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
   * Admin: Get single product by ID (including costPrice)
   */
  static async getAdminProductById(id) {
    const product = await Product.findById(id)
      .populate("brand", "name slug")
      .populate("category", "name slug");

    if (!product) {
      throw new AppError("Product not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return product;
  }

  /**
   * Admin: Create product with embedded variants
   * Enforces all catalog business rules.
   */
  static async createProduct(productData) {
    // 1. Validate Category exists and is active
    const category = await Category.findById(productData.category);
    if (!category || !category.isActive) {
      throw new AppError(
        "Cannot assign a non-existent or inactive category.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 2. Validate Brand exists and is active
    const brand = await Brand.findById(productData.brand);
    if (!brand || !brand.isActive) {
      throw new AppError(
        "Cannot assign a non-existent or inactive brand.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 3. Validate Variants
    if (!productData.variants || productData.variants.length === 0) {
      throw new AppError(
        "A product must have at least one variant.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // 4. Check for duplicate SKUs in input and across catalog
    const submittedSkus = new Set();
    for (const variant of productData.variants) {
      const upperSku = variant.sku.trim().toUpperCase();
      if (submittedSkus.has(upperSku)) {
        throw new AppError(
          `Duplicate SKU '${upperSku}' within submitted product variants.`,
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }
      submittedSkus.add(upperSku);

      // Check across catalog
      const existingProduct = await Product.findOne({ "variants.sku": upperSku });
      if (existingProduct) {
        throw new AppError(
          `A variant with SKU '${upperSku}' already exists in the catalog.`,
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }
    }

    // 5. If product is set to active, ensure at least one active variant exists
    if (productData.isActive) {
      const hasActiveVariant = productData.variants.some((v) => v.isActive !== false);
      if (!hasActiveVariant) {
        throw new AppError(
          "Product must have at least one active variant before activation.",
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    }

    // 6. Generate Slug if not provided
    const normalizedName = (productData.name || productData.title || "").trim();
    const generatedSlug = productData.slug
      ? productData.slug.trim().toLowerCase()
      : normalizedName
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, "");

    const existingSlug = await Product.findOne({ slug: generatedSlug });
    if (existingSlug) {
      throw new AppError(
        "A product with this slug already exists.",
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }

    // 7. Create product
    return Product.create({
      ...productData,
      name: normalizedName,
      slug: generatedSlug,
      tags: Array.isArray(productData.tags) ? productData.tags.map((t) => t.trim().toLowerCase()) : [],
      variants: productData.variants.map((v) => ({
        ...v,
        sku: v.sku.trim().toUpperCase()
      }))
    });
  }

  /**
   * Admin: Update product metadata
   */
  static async updateProduct(id, updateData) {
    const product = await this.getAdminProductById(id);

    // If category updated, verify it is active
    if (updateData.category && updateData.category !== product.category.toString()) {
      const category = await Category.findById(updateData.category);
      if (!category || !category.isActive) {
        throw new AppError(
          "Cannot assign a non-existent or inactive category.",
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      product.category = updateData.category;
    }

    // If brand updated, verify it is active
    if (updateData.brand && updateData.brand !== product.brand.toString()) {
      const brand = await Brand.findById(updateData.brand);
      if (!brand || !brand.isActive) {
        throw new AppError(
          "Cannot assign a non-existent or inactive brand.",
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      product.brand = updateData.brand;
    }

    // If slug updated, check uniqueness
    if (updateData.slug && updateData.slug.trim().toLowerCase() !== product.slug) {
      const duplicateSlug = await Product.findOne({
        _id: { $ne: id },
        slug: updateData.slug.trim().toLowerCase()
      });
      if (duplicateSlug) {
        throw new AppError(
          "A product with this slug already exists.",
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }
      product.slug = updateData.slug.trim().toLowerCase();
    }

    // If activating product, ensure it has at least one active variant
    if (updateData.isActive === true) {
      const hasActiveVariant = product.variants.some((v) => v.isActive);
      if (!hasActiveVariant) {
        throw new AppError(
          "Product must have at least one active variant before activation.",
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      product.isActive = true;
    } else if (updateData.isActive === false) {
      product.isActive = false;
    }

    if (updateData.name || updateData.title) product.name = (updateData.name || updateData.title).trim();
    if (updateData.description) product.description = updateData.description.trim();
    if (updateData.images) product.images = updateData.images;
    if (Array.isArray(updateData.tags)) product.tags = updateData.tags.map((t) => t.trim().toLowerCase());

    return product.save();
  }

  /**
   * Admin: Toggle product active status
   */
  static async setProductStatus(id, isActive) {
    const product = await this.getAdminProductById(id);

    if (isActive) {
      const hasActiveVariant = product.variants.some((v) => v.isActive);
      if (!hasActiveVariant) {
        throw new AppError(
          "Product must have at least one active variant before activation.",
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    }

    product.isActive = isActive;
    return product.save();
  }

  /**
   * Admin: Update single embedded variant safely using subdocument identity
   */
  static async updateVariant(productId, variantId, variantUpdate) {
    const product = await this.getAdminProductById(productId);
    const variant = product.variants.id(variantId);

    if (!variant) {
      throw new AppError("Variant not found in this product.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // If SKU is being modified, ensure uniqueness both within the same product AND across entire catalog
    if (variantUpdate.sku && variantUpdate.sku.trim().toUpperCase() !== variant.sku) {
      const upperSku = variantUpdate.sku.trim().toUpperCase();

      // 1. Application-level check: Check within the SAME product (other variants)
      const duplicateWithinProduct = product.variants.some(
        (v) => v._id.toString() !== variantId.toString() && v.sku === upperSku
      );
      if (duplicateWithinProduct) {
        throw new AppError(
          `Duplicate SKU '${upperSku}' within the same product.`,
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }

      // 2. Database/catalog check: Check across other products in catalog
      const duplicateProduct = await Product.findOne({
        _id: { $ne: productId },
        "variants.sku": upperSku
      });
      if (duplicateProduct) {
        throw new AppError(
          `A variant with SKU '${upperSku}' already exists in the catalog.`,
          HTTP_CODES.CONFLICT,
          ERROR_CODES.DUPLICATE_FIELD
        );
      }
      variant.sku = upperSku;
    }

    if (variantUpdate.price !== undefined) variant.price = variantUpdate.price;
    if (variantUpdate.costPrice !== undefined) variant.costPrice = variantUpdate.costPrice;
    if (variantUpdate.stock !== undefined) variant.stock = variantUpdate.stock;
    if (variantUpdate.attributes !== undefined) variant.attributes = variantUpdate.attributes;
    if (variantUpdate.images !== undefined) variant.images = variantUpdate.images;
    if (variantUpdate.isActive !== undefined) variant.isActive = variantUpdate.isActive;

    // If product is active and this was the only active variant being deactivated, check
    if (product.isActive && !product.variants.some((v) => v.isActive)) {
      product.isActive = false; // Auto-deactivate product if zero active variants remain
    }

    await product.save();
    return product;
  }

  /**
   * Admin: Add new variant to existing product
   */
  static async addVariant(productId, variantData) {
    const product = await this.getAdminProductById(productId);
    const upperSku = variantData.sku.trim().toUpperCase();

    // 1. Application-level check: Check within the SAME product
    const duplicateWithinProduct = product.variants.some((v) => v.sku === upperSku);
    if (duplicateWithinProduct) {
      throw new AppError(
        `Duplicate SKU '${upperSku}' within the same product.`,
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }

    // 2. Database/catalog check: Check across other products in catalog
    const existing = await Product.findOne({ "variants.sku": upperSku });
    if (existing) {
      throw new AppError(
        `A variant with SKU '${upperSku}' already exists in the catalog.`,
        HTTP_CODES.CONFLICT,
        ERROR_CODES.DUPLICATE_FIELD
      );
    }

    product.variants.push({
      ...variantData,
      sku: upperSku
    });

    await product.save();
    return product;
  }

  /**
   * Admin: Delete variant from product
   */
  static async deleteVariant(productId, variantId) {
    const product = await this.getAdminProductById(productId);
    const variant = product.variants.id(variantId);

    if (!variant) {
      throw new AppError("Variant not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (product.variants.length === 1) {
      throw new AppError(
        "Cannot delete the only variant of a product. Products must contain at least one variant.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    product.variants.pull(variantId);

    // If active variants count dropped to zero, deactivate product
    if (product.isActive && !product.variants.some((v) => v.isActive)) {
      product.isActive = false;
    }

    await product.save();
    return { product, message: "Variant deleted successfully." };
  }
}

module.exports = ProductService;
