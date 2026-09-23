const UserService = require("./user.service");
const ApiResponse = require("../../utils/ApiResponse");
const HTTP_CODES = require("../../constants/httpCodes");
const asyncHandler = require("../../utils/asyncHandler");

/**
 * Get profile for authenticated user
 * GET /api/v1/users/me
 */
const getMyProfile = asyncHandler(async (req, res) => {
  const user = await UserService.getProfile(req.session.userId);
  new ApiResponse(HTTP_CODES.OK, { user }, "User profile retrieved.").send(res);
});

/**
 * Update profile for authenticated user
 * PATCH /api/v1/users/me
 */
const updateMyProfile = asyncHandler(async (req, res) => {
  const user = await UserService.updateProfile(req.session.userId, req.body);
  new ApiResponse(HTTP_CODES.OK, { user }, "Profile updated successfully.").send(res);
});

/**
 * Admin: Get paginated list of users
 * GET /api/v1/admin/users
 */
const getUsersAdmin = asyncHandler(async (req, res) => {
  const result = await UserService.getUsersAdmin(req.query);
  new ApiResponse(HTTP_CODES.OK, result, "Users retrieved successfully.").send(res);
});

/**
 * Admin: Get user by ID
 * GET /api/v1/admin/users/:id
 */
const getUserByIdAdmin = asyncHandler(async (req, res) => {
  const user = await UserService.getUserByIdAdmin(req.params.id);
  new ApiResponse(HTTP_CODES.OK, { user }, "User retrieved successfully.").send(res);
});

/**
 * Admin: Block or unblock a user
 * PATCH /api/v1/admin/users/:id/block
 */
const toggleUserBlock = asyncHandler(async (req, res) => {
  const adminId = req.user._id;
  const result = await UserService.toggleUserBlock(req.params.id, req.body, adminId);
  const actionText = req.body.isBlocked ? "blocked" : "unblocked";
  new ApiResponse(HTTP_CODES.OK, result, `User account successfully ${actionText}.`).send(res);
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  getUsersAdmin,
  getUserByIdAdmin,
  toggleUserBlock
};

