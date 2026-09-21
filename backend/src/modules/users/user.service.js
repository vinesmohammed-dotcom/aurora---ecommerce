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
}

module.exports = UserService;
