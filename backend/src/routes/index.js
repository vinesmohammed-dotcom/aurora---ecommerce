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
const { publicOfferRouter, adminOfferRouter } = require("../modules/offers/offer.routes");
const { publicCouponRouter, adminCouponRouter } = require("../modules/coupons/coupon.routes");
const checkoutRoutes = require("../modules/checkout/checkout.routes");
const { customerOrderRouter, adminOrderRouter } = require("../modules/orders/order.routes");

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

// Promotional Offers & Coupons
apiRouter.use("/offers", publicOfferRouter);
apiRouter.use("/coupons", publicCouponRouter);

// Checkout Calculation Engine
apiRouter.use("/checkout", checkoutRoutes);

// Order Placement & Lifecycle
apiRouter.use("/orders", customerOrderRouter);

// Admin Management Endpoints
apiRouter.use("/admin/categories", adminCategoryRouter);
apiRouter.use("/admin/brands", adminBrandRouter);
apiRouter.use("/admin/products", adminProductRouter);
apiRouter.use("/admin/offers", adminOfferRouter);
apiRouter.use("/admin/coupons", adminCouponRouter);
apiRouter.use("/admin/orders", adminOrderRouter);

module.exports = apiRouter;
