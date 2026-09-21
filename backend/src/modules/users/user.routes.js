const { Router } = require("express");
const userController = require("./user.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { updateProfileSchema } = require("./user.validator");

const router = Router();

// Protected User Profile Endpoints
router.get("/me", requireAuth, userController.getMyProfile);
router.patch("/me", requireAuth, validate(updateProfileSchema), userController.updateMyProfile);

module.exports = router;
