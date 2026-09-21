const AddressService = require("./address.service");
const asyncHandler = require("../../utils/asyncHandler");
const HTTP_CODES = require("../../constants/httpCodes");

/**
 * Controller: List all addresses for authenticated user
 */
const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await AddressService.getAddresses(req.user._id);
  res.status(HTTP_CODES.OK).json({
    success: true,
    data: {
      addresses
    }
  });
});

/**
 * Controller: Get single address by ID
 */
const getAddressById = asyncHandler(async (req, res) => {
  const address = await AddressService.getAddressById(req.user._id, req.params.id);
  res.status(HTTP_CODES.OK).json({
    success: true,
    data: {
      address
    }
  });
});

/**
 * Controller: Create new shipping address
 */
const createAddress = asyncHandler(async (req, res) => {
  const address = await AddressService.createAddress(req.user._id, req.body);
  res.status(HTTP_CODES.CREATED).json({
    success: true,
    message: "Address added successfully.",
    data: {
      address
    }
  });
});

/**
 * Controller: Update existing address
 */
const updateAddress = asyncHandler(async (req, res) => {
  const address = await AddressService.updateAddress(req.user._id, req.params.id, req.body);
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: "Address updated successfully.",
    data: {
      address
    }
  });
});

/**
 * Controller: Mark address as default
 */
const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = await AddressService.setDefaultAddress(req.user._id, req.params.id);
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: "Default address updated.",
    data: {
      address
    }
  });
});

/**
 * Controller: Delete delivery address
 */
const deleteAddress = asyncHandler(async (req, res) => {
  const result = await AddressService.deleteAddress(req.user._id, req.params.id);
  res.status(HTTP_CODES.OK).json({
    success: true,
    message: result.message
  });
});

module.exports = {
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress
};
