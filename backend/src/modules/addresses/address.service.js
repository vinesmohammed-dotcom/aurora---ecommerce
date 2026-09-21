const Address = require("./address.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class AddressService {
  /**
   * List all addresses owned by authenticated user
   */
  static async getAddresses(userId) {
    return Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
  }

  /**
   * Get single address with strict ownership validation (anti-IDOR)
   */
  static async getAddressById(userId, addressId) {
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      throw new AppError(
        "Address not found or access denied.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return address;
  }

  /**
   * Create new address for authenticated user
   * Rule: First address is automatically default. Setting default unsets any previous default.
   */
  static async createAddress(userId, addressData) {
    const addressCount = await Address.countDocuments({ userId });
    const shouldBeDefault = addressCount === 0 || Boolean(addressData.isDefault);

    if (shouldBeDefault) {
      // Unset previous default address for this user
      await Address.updateMany({ userId, isDefault: true }, { isDefault: false });
    }

    const address = await Address.create({
      ...addressData,
      userId, // Strictly bound to session user
      isDefault: shouldBeDefault
    });

    return address;
  }

  /**
   * Update existing address with strict ownership validation
   */
  static async updateAddress(userId, addressId, updateData) {
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      throw new AppError(
        "Address not found or access denied.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // If marked as default, unset other defaults
    if (updateData.isDefault === true) {
      await Address.updateMany(
        { userId, _id: { $ne: addressId }, isDefault: true },
        { isDefault: false }
      );
      address.isDefault = true;
    } else if (updateData.isDefault === false && address.isDefault) {
      // If unsetting default and other addresses exist, prevent having zero defaults if business requires,
      // or allow it. Let's allow user having no default as requested in prompt test scenario: "user having no default"
      address.isDefault = false;
    }

    if (updateData.fullName) address.fullName = updateData.fullName;
    if (updateData.phone) address.phone = updateData.phone;
    if (updateData.addressLine1) address.addressLine1 = updateData.addressLine1;
    if (updateData.addressLine2 !== undefined) address.addressLine2 = updateData.addressLine2;
    if (updateData.city) address.city = updateData.city;
    if (updateData.state) address.state = updateData.state;
    if (updateData.postalCode) address.postalCode = updateData.postalCode;
    if (updateData.country) address.country = updateData.country;
    if (updateData.label) address.label = updateData.label;

    await address.save();
    return address;
  }

  /**
   * Set specific address as default
   */
  static async setDefaultAddress(userId, addressId) {
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      throw new AppError(
        "Address not found or access denied.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Unset all existing defaults for this user
    await Address.updateMany({ userId, isDefault: true }, { isDefault: false });

    // Set selected as default
    address.isDefault = true;
    await address.save();

    return address;
  }

  /**
   * Delete address with ownership check
   * Rule: If deleted address was default, promote next available address to default
   */
  static async deleteAddress(userId, addressId) {
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      throw new AppError(
        "Address not found or access denied.",
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const wasDefault = address.isDefault;
    await Address.deleteOne({ _id: addressId, userId });

    if (wasDefault) {
      // Find another address to promote if available
      const remainingAddress = await Address.findOne({ userId }).sort({ updatedAt: -1 });
      if (remainingAddress) {
        remainingAddress.isDefault = true;
        await remainingAddress.save();
      }
    }

    return { message: "Address deleted successfully." };
  }
}

module.exports = AddressService;
