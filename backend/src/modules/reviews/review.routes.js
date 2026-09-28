const { Router } = require("express");
const reviewController = require("./review.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const { reviewLimiter } = require("../../middlewares/rateLimiter.middleware");
const {
  createReviewSchema,
  updateReviewSchema,
  updateReviewStatusSchema,
  queryReviewsSchema,
  adminQueryReviewsSchema,
  productIdParamSchema,
  reviewIdParamSchema
} = require("./review.validator");

/**
 * 1. Product Nested Review Router
 * Mounted at: /api/v1/products/:productId/reviews
 */
const productReviewRouter = Router({ mergeParams: true });

// Public: Get reviews for product
productReviewRouter.get(
  "/",
  validate(productIdParamSchema, "params"),
  validate(queryReviewsSchema, "query"),
  reviewController.getProductReviews
);

// Customer: Check review eligibility for product
productReviewRouter.get(
  "/eligibility",
  requireAuth,
  validate(productIdParamSchema, "params"),
  reviewController.checkEligibility
);

// Customer: Submit verified review for product
productReviewRouter.post(
  "/",
  requireAuth,
  reviewLimiter,
  validate(productIdParamSchema, "params"),
  validate(createReviewSchema, "body"),
  reviewController.createProductReview
);

/**
 * 2. General Review Action Router
 * Mounted at: /api/v1/reviews
 */
const reviewRouter = Router();

// Customer: Update own review
reviewRouter.put(
  "/:reviewId",
  requireAuth,
  validate(reviewIdParamSchema, "params"),
  validate(updateReviewSchema, "body"),
  reviewController.updateReview
);

// Customer: Delete own review
reviewRouter.delete(
  "/:reviewId",
  requireAuth,
  validate(reviewIdParamSchema, "params"),
  reviewController.deleteReview
);

// Customer: Vote review as helpful
reviewRouter.post(
  "/:reviewId/helpful",
  requireAuth,
  validate(reviewIdParamSchema, "params"),
  reviewController.voteHelpful
);

/**
 * 3. Administrative Review Management Router
 * Mounted at: /api/v1/admin/reviews
 */
const adminReviewRouter = Router();

adminReviewRouter.use(requireAuth, requireRole("ADMIN"));

// Admin: Query all reviews with status filtering
adminReviewRouter.get(
  "/",
  validate(adminQueryReviewsSchema, "query"),
  reviewController.getAdminReviews
);

// Admin: Update review moderation status (PUBLISHED | HIDDEN)
adminReviewRouter.patch(
  "/:reviewId/status",
  validate(reviewIdParamSchema, "params"),
  validate(updateReviewStatusSchema, "body"),
  reviewController.updateReviewStatus
);

// Admin: Delete review permanently
adminReviewRouter.delete(
  "/:reviewId",
  validate(reviewIdParamSchema, "params"),
  reviewController.deleteReviewAdmin
);

module.exports = {
  productReviewRouter,
  reviewRouter,
  adminReviewRouter
};
