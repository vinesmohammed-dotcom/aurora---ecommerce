const { Router } = require("express");
const productController = require("./product.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const {
  createProductSchema,
  updateProductSchema,
  updateVariantSchema,
  toggleProductStatusSchema,
  variantInputSchema,
  queryProductSchema
} = require("./product.validator");

// Helper for validating query params using Zod
const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (err) {
    next(err);
  }
};

// Public catalog routes: /api/v1/products
const publicProductRouter = Router();
publicProductRouter.get("/", validateQuery(queryProductSchema), productController.getPublicProducts);
publicProductRouter.get("/:slug", productController.getPublicProductBySlug);

// Admin catalog routes: /api/v1/admin/products
const adminProductRouter = Router();
adminProductRouter.use(requireAuth, requireRole("ADMIN"));

adminProductRouter.get("/inventory", productController.getInventoryAdmin);
adminProductRouter.get("/", productController.getAdminProducts);
adminProductRouter.get("/:id", productController.getAdminProductById);
adminProductRouter.post("/", validate(createProductSchema), productController.createProduct);
adminProductRouter.patch("/:id", validate(updateProductSchema), productController.updateProduct);
adminProductRouter.patch("/:id/status", validate(toggleProductStatusSchema), productController.toggleProductStatus);
adminProductRouter.patch("/:id/variants/:variantId", validate(updateVariantSchema), productController.updateVariant);
adminProductRouter.post("/:id/variants", validate(variantInputSchema), productController.addVariant);
adminProductRouter.delete("/:id/variants/:variantId", productController.deleteVariant);

module.exports = {
  publicProductRouter,
  adminProductRouter
};
