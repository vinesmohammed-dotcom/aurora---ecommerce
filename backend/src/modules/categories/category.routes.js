const { Router } = require("express");
const categoryController = require("./category.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const { createCategorySchema, updateCategorySchema } = require("./category.validator");

// Public routes: /api/v1/categories
const publicCategoryRouter = Router();
publicCategoryRouter.get("/", categoryController.getActiveCategories);

// Admin routes: /api/v1/admin/categories
const adminCategoryRouter = Router();
adminCategoryRouter.use(requireAuth, requireRole("ADMIN"));

adminCategoryRouter.get("/", categoryController.getAdminCategories);
adminCategoryRouter.post("/", validate(createCategorySchema), categoryController.createCategory);
adminCategoryRouter.get("/:id", categoryController.getCategoryById);
adminCategoryRouter.patch("/:id", validate(updateCategorySchema), categoryController.updateCategory);
adminCategoryRouter.delete("/:id", categoryController.deleteCategory);

module.exports = {
  publicCategoryRouter,
  adminCategoryRouter
};
