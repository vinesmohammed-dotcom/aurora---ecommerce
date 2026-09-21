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

module.exports = {
  getMyProfile,
  updateMyProfile
};
