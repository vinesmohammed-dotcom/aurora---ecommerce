const express = require("express");
const addressController = require("./address.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth } = require("../../middlewares/auth.middleware");
const {
  addressIdParamSchema,
  createAddressSchema,
  updateAddressSchema
} = require("./address.validator");

const router = express.Router();

// All address operations require authentication
router.use(requireAuth);

router.get("/", addressController.getAddresses);
router.post("/", validate(createAddressSchema, "body"), addressController.createAddress);

router.get("/:id", validate(addressIdParamSchema, "params"), addressController.getAddressById);
router.put(
  "/:id",
  validate(addressIdParamSchema, "params"),
  validate(updateAddressSchema, "body"),
  addressController.updateAddress
);
router.patch("/:id/default", validate(addressIdParamSchema, "params"), addressController.setDefaultAddress);
router.delete("/:id", validate(addressIdParamSchema, "params"), addressController.deleteAddress);

module.exports = router;
