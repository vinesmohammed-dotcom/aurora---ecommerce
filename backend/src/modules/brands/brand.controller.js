const BrandService = require("./brand.service");
const ApiResponse = require("../../utils/ApiResponse");
const HTTP_CODES = require("../../constants/httpCodes");
const asyncHandler = require("../../utils/asyncHandler");

/**
 * Public: Get all active brands
 * GET /api/v1/brands
 */
const getActiveBrands = asyncHandler(async (req, res) => {
  const brands = await BrandService.getActiveBrands();
  new ApiResponse(HTTP_CODES.OK, brands, "Active brands fetched successfully.").send(res);
});

/**
 * Admin: Get paginated brands
 * GET /api/v1/admin/brands
 */
const getAdminBrands = asyncHandler(async (req, res) => {
  const { brands, meta } = await BrandService.getAdminBrands(req.query);
  new ApiResponse(HTTP_CODES.OK, brands, "Brands fetched successfully.", meta).send(res);
});

/**
 * Admin: Get single brand by ID
 * GET /api/v1/admin/brands/:id
 */
const getBrandById = asyncHandler(async (req, res) => {
  const brand = await BrandService.getBrandById(req.params.id);
  new ApiResponse(HTTP_CODES.OK, brand, "Brand details fetched.").send(res);
});

/**
 * Admin: Create brand
 * POST /api/v1/admin/brands
 */
const createBrand = asyncHandler(async (req, res) => {
  const brand = await BrandService.createBrand(req.body);
  new ApiResponse(HTTP_CODES.CREATED, brand, "Brand created successfully.").send(res);
});

/**
 * Admin: Update brand
 * PATCH /api/v1/admin/brands/:id
 */
const updateBrand = asyncHandler(async (req, res) => {
  const brand = await BrandService.updateBrand(req.params.id, req.body);
  new ApiResponse(HTTP_CODES.OK, brand, "Brand updated successfully.").send(res);
});

/**
 * Admin: Toggle brand status
 * PATCH /api/v1/admin/brands/:id/status
 */
const toggleBrandStatus = asyncHandler(async (req, res) => {
  const brand = await BrandService.setBrandStatus(req.params.id, req.body.isActive);
  new ApiResponse(HTTP_CODES.OK, brand, "Brand status updated successfully.").send(res);
});

/**
 * Admin: Safe delete brand
 * DELETE /api/v1/admin/brands/:id
 */
const deleteBrand = asyncHandler(async (req, res) => {
  const result = await BrandService.deleteBrand(req.params.id);
  new ApiResponse(HTTP_CODES.OK, result.brand, result.message).send(res);
});

module.exports = {
  getActiveBrands,
  getAdminBrands,
  getBrandById,
  createBrand,
  updateBrand,
  toggleBrandStatus,
  deleteBrand
};
