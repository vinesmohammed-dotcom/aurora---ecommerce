const ReviewService = require("./review.service");
const ApiResponse = require("../../utils/ApiResponse");
const HTTP_CODES = require("../../constants/httpCodes");
const asyncHandler = require("../../utils/asyncHandler");

/**
 * Customer: Submit a new product review
 * POST /api/v1/products/:productId/reviews
 */
const createProductReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;
  const { rating, title, comment, orderId, orderItemId } = req.body;

  const review = await ReviewService.createReview({
    userId,
    productId,
    rating,
    title,
    comment,
    orderId,
    orderItemId
  });

  new ApiResponse(HTTP_CODES.CREATED, review, "Review submitted successfully.").send(res);
});

/**
 * Public: Get reviews for a product
 * GET /api/v1/products/:productId/reviews
 */
const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { reviews, summary, meta } = await ReviewService.getProductReviews(productId, req.query);

  new ApiResponse(HTTP_CODES.OK, { reviews, summary }, "Reviews fetched successfully.", meta).send(res);
});

/**
 * Customer: Check review eligibility for a product
 * GET /api/v1/products/:productId/reviews/eligibility
 */
const checkEligibility = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  const eligibility = await ReviewService.checkEligibility(userId, productId);
  new ApiResponse(HTTP_CODES.OK, eligibility, "Review eligibility checked.").send(res);
});

/**
 * Customer: Update own review
 * PUT /api/v1/reviews/:reviewId
 */
const updateReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user._id;

  const review = await ReviewService.updateReview(reviewId, userId, req.body);
  new ApiResponse(HTTP_CODES.OK, review, "Review updated successfully.").send(res);
});

/**
 * Customer: Delete own review
 * DELETE /api/v1/reviews/:reviewId
 */
const deleteReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user._id;

  await ReviewService.deleteReview(reviewId, userId);
  new ApiResponse(HTTP_CODES.OK, null, "Review deleted successfully.").send(res);
});

/**
 * Admin: Get all reviews with status filtering
 * GET /api/v1/admin/reviews
 */
const getAdminReviews = asyncHandler(async (req, res) => {
  const { reviews, meta } = await ReviewService.getAdminReviews(req.query);
  new ApiResponse(HTTP_CODES.OK, reviews, "Admin reviews fetched successfully.", meta).send(res);
});

/**
 * Admin: Update review moderation status
 * PATCH /api/v1/admin/reviews/:reviewId/status
 */
const updateReviewStatus = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { status } = req.body;

  const review = await ReviewService.updateReviewStatus(reviewId, status);
  new ApiResponse(HTTP_CODES.OK, review, "Review status updated successfully.").send(res);
});

/**
 * Admin: Delete review permanently
 * DELETE /api/v1/admin/reviews/:reviewId
 */
const deleteReviewAdmin = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  await ReviewService.deleteReviewAdmin(reviewId);
  new ApiResponse(HTTP_CODES.OK, null, "Review deleted successfully by administrator.").send(res);
});

/**
 * Customer: Mark review as helpful
 * POST /api/v1/reviews/:reviewId/helpful
 */
const voteHelpful = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user._id;

  const result = await ReviewService.voteHelpful(reviewId, userId);
  new ApiResponse(HTTP_CODES.OK, result, "Review marked as helpful.").send(res);
});

module.exports = {
  createProductReview,
  getProductReviews,
  checkEligibility,
  updateReview,
  deleteReview,
  voteHelpful,
  getAdminReviews,
  updateReviewStatus,
  deleteReviewAdmin
};
