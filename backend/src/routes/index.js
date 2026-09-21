const { Router } = require("express");
const healthRoutes = require("../modules/health/health.routes");
const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/user.routes");
const { publicCategoryRouter, adminCategoryRouter } = require("../modules/categories/category.routes");
const { publicBrandRouter, adminBrandRouter } = require("../modules/brands/brand.routes");
const { publicProductRouter, adminProductRouter } = require("../modules/products/product.routes");

const apiRouter = Router();

// Health Check probes: /api/v1/health & /api/v1/health/ready
apiRouter.use("/health", healthRoutes);

// Authentication & Profile Endpoints
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);

// Public Catalog Endpoints
apiRouter.use("/categories", publicCategoryRouter);
apiRouter.use("/brands", publicBrandRouter);
apiRouter.use("/products", publicProductRouter);

// Admin Management Endpoints
apiRouter.use("/admin/categories", adminCategoryRouter);
apiRouter.use("/admin/brands", adminBrandRouter);
apiRouter.use("/admin/products", adminProductRouter);

module.exports = apiRouter;
