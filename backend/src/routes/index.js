const { Router } = require("express");
const healthRoutes = require("../modules/health/health.routes");
const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/user.routes");
const { publicCategoryRouter, adminCategoryRouter } = require("../modules/categories/category.routes");
const { publicBrandRouter, adminBrandRouter } = require("../modules/brands/brand.routes");
const { publicProductRouter, adminProductRouter } = require("../modules/products/product.routes");
const addressRoutes = require("../modules/addresses/address.routes");
const cartRoutes = require("../modules/cart/cart.routes");
const wishlistRoutes = require("../modules/wishlist/wishlist.routes");

const apiRouter = Router();

// Health Check probes: /api/v1/health & /api/v1/health/ready
apiRouter.use("/health", healthRoutes);

// Authentication & Profile Endpoints
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);

// Address Management
apiRouter.use("/addresses", addressRoutes);

// Cart & Wishlist Endpoints
apiRouter.use("/cart", cartRoutes);
apiRouter.use("/wishlist", wishlistRoutes);

// Public Catalog Endpoints
apiRouter.use("/categories", publicCategoryRouter);
apiRouter.use("/brands", publicBrandRouter);
apiRouter.use("/products", publicProductRouter);

// Admin Management Endpoints
apiRouter.use("/admin/categories", adminCategoryRouter);
apiRouter.use("/admin/brands", adminBrandRouter);
apiRouter.use("/admin/products", adminProductRouter);

module.exports = apiRouter;
