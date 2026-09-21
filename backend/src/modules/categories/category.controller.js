const CategoryService = require("./category.service");
const ApiResponse = require("../../utils/ApiResponse");
const HTTP_CODES = require("../../constants/httpCodes");
const asyncHandler = require("../../utils/asyncHandler");

/**
 * Public: Get all active categories
 * GET /api/v1/categories
 */
const getActiveCategories = asyncHandler(async (req, res) => {
  const categories = await CategoryService.getActiveCategories();
  new ApiResponse(HTTP_CODES.OK, categories, "Active categories fetched successfully.").send(res);
});

/**
 * Admin: Get paginated categories
 * GET /api/v1/admin/categories
 */
const getAdminCategories = asyncHandler(async (req, res) => {
  const { categories, meta } = await CategoryService.getAdminCategories(req.query);
  new ApiResponse(HTTP_CODES.OK, categories, "Categories fetched successfully.", meta).send(res);
});

/**
 * Admin: Get single category by ID
 * GET /api/v1/admin/categories/:id
 */
const getCategoryById = asyncHandler(async (req, res) => {
  const category = await CategoryService.getCategoryById(req.params.id);
  new ApiResponse(HTTP_CODES.OK, category, "Category details fetched.").send(res);
});

/**
 * Admin: Create category
 * POST /api/v1/admin/categories
 */
const createCategory = asyncHandler(async (req, res) => {
  const category = await CategoryService.createCategory(req.body);
  new ApiResponse(HTTP_CODES.CREATED, category, "Category created successfully.").send(res);
});

/**
 * Admin: Update category
 * PATCH /api/v1/admin/categories/:id
 */
const updateCategory = asyncHandler(async (req, res) => {
  const category = await CategoryService.updateCategory(req.params.id, req.body);
  new ApiResponse(HTTP_CODES.OK, category, "Category updated successfully.").send(res);
});

/**
 * Admin: Safe delete or toggle category
 * DELETE /api/v1/admin/categories/:id
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const result = await CategoryService.deleteCategory(req.params.id);
  new ApiResponse(HTTP_CODES.OK, result.category, result.message).send(res);
});

module.exports = {
  getActiveCategories,
  getAdminCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};
