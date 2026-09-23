const User = require("./user.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class UserService {
  /**
   * Get user profile by session userId
   * @param {string} userId
   */
  static async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return user;
  }

  /**
   * Update profile fields (name, phone)
   * @param {string} userId
   * @param {Object} updateData
   */
  static async updateProfile(userId, updateData) {
    const allowedUpdates = {};
    if (updateData.name) allowedUpdates.name = updateData.name;
    if (updateData.phone) allowedUpdates.phone = updateData.phone;

    const user = await User.findByIdAndUpdate(userId, allowedUpdates, {
      new: true,
      runValidators: true
    });

    if (!user) {
      throw new AppError("User not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return user;
  }

  /**
   * Admin: List users with search, filtering, and pagination
   */
  static async getUsersAdmin({ page = 1, limit = 20, search, role, isBlocked, isVerified } = {}) {
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (typeof isBlocked === "string") {
      filter.isBlocked = isBlocked === "true";
    }

    if (typeof isVerified === "string") {
      filter.isVerified = isVerified === "true";
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    return {
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Admin: Get user by ID with full details
   */
  static async getUserByIdAdmin(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return user;
  }

  /**
   * Admin: Block or Unblock user account
   */
  static async toggleUserBlock(targetUserId, { isBlocked, reason = "" }, adminId) {
    if (targetUserId.toString() === adminId.toString()) {
      throw new AppError("Administrators cannot block their own account.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const user = await User.findByIdAndUpdate(
      targetUserId,
      { isBlocked },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError("User not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return { user, reason };
  }
}

module.exports = UserService;

