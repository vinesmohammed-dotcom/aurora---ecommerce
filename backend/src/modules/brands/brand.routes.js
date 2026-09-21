const { Router } = require("express");
const brandController = require("./brand.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const {
  createBrandSchema,
  updateBrandSchema,
  toggleBrandStatusSchema
} = require("./brand.validator");

// Public routes: /api/v1/brands
const publicBrandRouter = Router();
publicBrandRouter.get("/", brandController.getActiveBrands);

// Admin routes: /api/v1/admin/brands
const adminBrandRouter = Router();
adminBrandRouter.use(requireAuth, requireRole("ADMIN"));

adminBrandRouter.get("/", brandController.getAdminBrands);
adminBrandRouter.post("/", validate(createBrandSchema), brandController.createBrand);
adminBrandRouter.get("/:id", brandController.getBrandById);
adminBrandRouter.patch("/:id", validate(updateBrandSchema), brandController.updateBrand);
adminBrandRouter.patch("/:id/status", validate(toggleBrandStatusSchema), brandController.toggleBrandStatus);
adminBrandRouter.delete("/:id", brandController.deleteBrand);

module.exports = {
  publicBrandRouter,
  adminBrandRouter
};
