const ProductService = require("./product.service");
const ApiResponse = require("../../utils/ApiResponse");
const HTTP_CODES = require("../../constants/httpCodes");
const asyncHandler = require("../../utils/asyncHandler");

/**
 * Public: Query active catalog with pagination, filters, search, and sorting
 * GET /api/v1/products
 */
const getPublicProducts = asyncHandler(async (req, res) => {
  const { products, meta } = await ProductService.getPublicProducts(req.query);
  new ApiResponse(HTTP_CODES.OK, products, "Products fetched successfully.", meta).send(res);
});

/**
 * Public: Get single product detail by slug
 * GET /api/v1/products/:slug
 */
const getPublicProductBySlug = asyncHandler(async (req, res) => {
  const product = await ProductService.getPublicProductBySlug(req.params.slug);
  new ApiResponse(HTTP_CODES.OK, product, "Product details fetched successfully.").send(res);
});

/**
 * Admin: Get paginated products for dashboard
 * GET /api/v1/admin/products
 */
const getAdminProducts = asyncHandler(async (req, res) => {
  const { products, meta } = await ProductService.getAdminProducts(req.query);
  new ApiResponse(HTTP_CODES.OK, products, "Admin products fetched successfully.", meta).send(res);
});

/**
 * Admin: Get product detail by ID
 * GET /api/v1/admin/products/:id
 */
const getAdminProductById = asyncHandler(async (req, res) => {
  const product = await ProductService.getAdminProductById(req.params.id);
  new ApiResponse(HTTP_CODES.OK, product, "Product fetched successfully.").send(res);
});

/**
 * Admin: Create product
 * POST /api/v1/admin/products
 */
const createProduct = asyncHandler(async (req, res) => {
  const product = await ProductService.createProduct(req.body);
  new ApiResponse(HTTP_CODES.CREATED, product, "Product created successfully.").send(res);
});

/**
 * Admin: Update product metadata
 * PATCH /api/v1/admin/products/:id
 */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await ProductService.updateProduct(req.params.id, req.body);
  new ApiResponse(HTTP_CODES.OK, product, "Product updated successfully.").send(res);
});

/**
 * Admin: Toggle product status
 * PATCH /api/v1/admin/products/:id/status
 */
const toggleProductStatus = asyncHandler(async (req, res) => {
  const product = await ProductService.setProductStatus(req.params.id, req.body.isActive);
  new ApiResponse(HTTP_CODES.OK, product, "Product status updated successfully.").send(res);
});

/**
 * Admin: Update single embedded variant
 * PATCH /api/v1/admin/products/:id/variants/:variantId
 */
const updateVariant = asyncHandler(async (req, res) => {
  const product = await ProductService.updateVariant(req.params.id, req.params.variantId, req.body);
  new ApiResponse(HTTP_CODES.OK, product, "Variant updated successfully.").send(res);
});

/**
 * Admin: Add new variant to product
 * POST /api/v1/admin/products/:id/variants
 */
const addVariant = asyncHandler(async (req, res) => {
  const product = await ProductService.addVariant(req.params.id, req.body);
  new ApiResponse(HTTP_CODES.CREATED, product, "Variant added successfully.").send(res);
});

/**
 * Admin: Delete variant from product
 * DELETE /api/v1/admin/products/:id/variants/:variantId
 */
const deleteVariant = asyncHandler(async (req, res) => {
  const result = await ProductService.deleteVariant(req.params.id, req.params.variantId);
  new ApiResponse(HTTP_CODES.OK, result.product, result.message).send(res);
});

/**
 * Admin: Get inventory matrix
 * GET /api/v1/admin/products/inventory
 */
const getInventoryAdmin = asyncHandler(async (req, res) => {
  const result = await ProductService.getInventoryAdmin(req.query);
  new ApiResponse(HTTP_CODES.OK, result, "Inventory fetched successfully.").send(res);
});

module.exports = {
  getPublicProducts,
  getPublicProductBySlug,
  getAdminProducts,
  getAdminProductById,
  getInventoryAdmin,
  createProduct,
  updateProduct,
  toggleProductStatus,
  updateVariant,
  addVariant,
  deleteVariant
};

