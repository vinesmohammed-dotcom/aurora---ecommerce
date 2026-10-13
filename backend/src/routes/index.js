const { Router } = require("express");
const healthRoutes = require("../modules/health/health.routes");
const authRoutes = require("../modules/auth/auth.routes");
const { customerUserRouter, adminUserRouter } = require("../modules/users/user.routes");
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
const paymentRoutes = require("../modules/payments/payment.routes");
const { walletRouter, adminWalletRouter } = require("../modules/wallet/wallet.routes");
const { refundRouter, adminRefundRouter } = require("../modules/refunds/refund.routes");
const reportRouter = require("../modules/reports/report.routes");
const {
  productReviewRouter,
  reviewRouter,
  adminReviewRouter
} = require("../modules/reviews/review.routes");

const apiRouter = Router();

// Health Check probes: /api/v1/health & /api/v1/health/ready
apiRouter.use("/health", healthRoutes);

// Authentication & Profile Endpoints
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", customerUserRouter);

// Address Management
apiRouter.use("/addresses", addressRoutes);

// Cart & Wishlist Endpoints
apiRouter.use("/cart", cartRoutes);
apiRouter.use("/wishlist", wishlistRoutes);

// Customer Wallet & Append-Only Ledger
apiRouter.use("/wallet", walletRouter);

// Customer Product Reviews & Ratings Endpoints
apiRouter.use("/products/:productId/reviews", productReviewRouter);
apiRouter.use("/reviews", reviewRouter);

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

// Online Payment Gateway (Razorpay) & Webhooks
apiRouter.use("/payments", paymentRoutes);

// Gateway Refunds (Razorpay)
apiRouter.use("/refunds", refundRouter);

// Admin Management Endpoints
apiRouter.use("/admin/users", adminUserRouter);
apiRouter.use("/admin/categories", adminCategoryRouter);
apiRouter.use("/admin/brands", adminBrandRouter);
apiRouter.use("/admin/products", adminProductRouter);
apiRouter.use("/admin/reviews", adminReviewRouter);
apiRouter.use("/admin/offers", adminOfferRouter);
apiRouter.use("/admin/coupons", adminCouponRouter);
apiRouter.use("/admin/orders", adminOrderRouter);
apiRouter.use("/admin/wallets", adminWalletRouter);
apiRouter.use("/admin/refunds", adminRefundRouter);
apiRouter.use("/admin/reports", reportRouter);

module.exports = apiRouter;
