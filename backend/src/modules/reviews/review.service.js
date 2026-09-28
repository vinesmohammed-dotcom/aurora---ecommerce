const mongoose = require("mongoose");
const Review = require("./review.model");
const Product = require("../products/product.model");
const Order = require("../orders/order.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

/**
 * Basic HTML/script sanitization to prevent XSS in user review titles and comments
 */
const sanitizeText = (text) => {
  if (typeof text !== "string") return "";
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
};

class ReviewService {
  /**
   * Customer: Create a verified purchase product review
   * Enforces all 5 Verified Purchase rules server-authoritatively.
   */
  static async createReview({ userId, productId, rating, title = "", comment, orderId, orderItemId }) {
    // 1. Verify Product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError("Product not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    let resolvedOrderId = orderId;
    let resolvedOrderItemId = orderItemId;

    // 2. Validate Verified Purchase Rule
    if (orderId && orderItemId) {
      // Explicit order item referenced by client
      const order = await Order.findById(orderId);
      if (!order) {
        throw new AppError("Referenced order not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
      }

      // Rule 2: Order must belong to authenticated user
      if (order.userId.toString() !== userId.toString()) {
        throw new AppError(
          "Referenced order does not belong to the authenticated user.",
          HTTP_CODES.FORBIDDEN,
          ERROR_CODES.FORBIDDEN
        );
      }

      // Rule 3: Order must contain specified product and order item
      const item = (order.items || []).find(
        (it) => it._id.toString() === orderItemId.toString() && it.productId.toString() === productId.toString()
      );
      if (!item) {
        throw new AppError(
          "The order does not contain the specified product item.",
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.BAD_REQUEST
        );
      }

      // Rule 4: Order must have reached DELIVERED state
      if (order.orderStatus !== "DELIVERED") {
        throw new AppError(
          "Reviews can only be submitted for delivered orders.",
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.BAD_REQUEST
        );
      }

      // Rule 5: Cannot review the same order item more than once
      const existing = await Review.findOne({ orderItemId });
      if (existing) {
        throw new AppError(
          "A review has already been submitted for this order item.",
          HTTP_CODES.CONFLICT,
          ERROR_CODES.CONFLICT
        );
      }
    } else {
      // Auto-resolve eligible purchase if orderId/orderItemId omitted
      const deliveredOrders = await Order.find({
        userId,
        orderStatus: "DELIVERED",
        "items.productId": productId
      });

      if (deliveredOrders.length === 0) {
        // Check if user has non-delivered orders for clearer feedback
        const anyOrders = await Order.find({ userId, "items.productId": productId });
        if (anyOrders.length > 0) {
          throw new AppError(
            "Reviews can only be submitted for delivered orders.",
            HTTP_CODES.BAD_REQUEST,
            ERROR_CODES.BAD_REQUEST
          );
        }
        throw new AppError(
          "You can only review products from delivered orders you have purchased.",
          HTTP_CODES.FORBIDDEN,
          ERROR_CODES.FORBIDDEN
        );
      }

      // Find an order item that has not yet been reviewed
      const candidateItems = [];
      for (const ord of deliveredOrders) {
        for (const itm of ord.items) {
          if (itm.productId.toString() === productId.toString()) {
            candidateItems.push({ orderId: ord._id, orderItemId: itm._id });
          }
        }
      }

      const candidateIds = candidateItems.map((c) => c.orderItemId);
      const existingReviews = await Review.find({ orderItemId: { $in: candidateIds } });
      const reviewedIdsSet = new Set(existingReviews.map((r) => r.orderItemId.toString()));

      const eligible = candidateItems.find((c) => !reviewedIdsSet.has(c.orderItemId.toString()));
      if (!eligible) {
        throw new AppError(
          "You have already submitted a review for all eligible purchases of this product.",
          HTTP_CODES.CONFLICT,
          ERROR_CODES.CONFLICT
        );
      }

      resolvedOrderId = eligible.orderId;
      resolvedOrderItemId = eligible.orderItemId;
    }

    // 3. Create Review with server-attested isVerifiedPurchase = true
    const sanitizedTitle = sanitizeText(title);
    const sanitizedComment = sanitizeText(comment);

    const review = await Review.create({
      productId,
      userId,
      orderId: resolvedOrderId,
      orderItemId: resolvedOrderItemId,
      rating: Math.round(rating),
      title: sanitizedTitle,
      comment: sanitizedComment,
      isVerifiedPurchase: true,
      status: "PUBLISHED"
    });

    const populatedReview = await Review.findById(review._id)
      .populate("userId", "name")
      .lean();

    return populatedReview;
  }

  /**
   * Public: Query published product reviews with pagination, sorting, and rating summary
   */
  static async getProductReviews(productId, { page = 1, limit = 10, rating, sort = "newest" } = {}) {
    const prodId = new mongoose.Types.ObjectId(productId);
    const query = {
      productId: prodId,
      status: "PUBLISHED"
    };

    if (rating !== undefined && rating !== null) {
      query.rating = Number(rating);
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      highest: { rating: -1, createdAt: -1 },
      lowest: { rating: 1, createdAt: -1 }
    };
    const sortOption = sortMap[sort] || sortMap.newest;

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [total, reviews, summary] = await Promise.all([
      Review.countDocuments(query),
      Review.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(safeLimit)
        .populate("userId", "name")
        .lean(),
      this.getProductRatingSummary(productId)
    ]);

    // Format safe reviewer output
    const formattedReviews = reviews.map((r) => ({
      _id: r._id,
      productId: r.productId,
      userId: r.userId?._id || r.userId,
      user: r.userId,
      reviewerName: r.userId?.name || "Customer",
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      helpfulCount: r.helpfulCount || 0,
      isVerifiedPurchase: r.isVerifiedPurchase,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    return {
      reviews: formattedReviews,
      summary,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
        hasNextPage: safePage * safeLimit < total,
        hasPrevPage: safePage > 1
      }
    };
  }

  /**
   * Customer: Check if authenticated user can review this product
   */
  static async checkEligibility(userId, productId) {
    const deliveredOrders = await Order.find({
      userId,
      orderStatus: "DELIVERED",
      "items.productId": productId
    }).sort({ createdAt: -1 });

    const candidateItems = [];
    for (const ord of deliveredOrders) {
      for (const itm of ord.items) {
        if (itm.productId.toString() === productId.toString()) {
          candidateItems.push({ orderId: ord._id, orderItemId: itm._id });
        }
      }
    }

    if (candidateItems.length === 0) {
      return {
        canReview: false,
        eligible: false,
        hasDeliveredPurchase: false,
        alreadyReviewed: false,
        hasExistingReview: false,
        eligibleOrderItem: null,
        userReview: null,
        existingReview: null,
        eligiblePurchases: []
      };
    }

    const candidateIds = candidateItems.map((c) => c.orderItemId);
    const existingReviews = await Review.find({
      userId,
      productId
    }).sort({ createdAt: -1 });

    const reviewedIdsSet = new Set(existingReviews.map((r) => r.orderItemId.toString()));
    const unreviewedItem = candidateItems.find((c) => !reviewedIdsSet.has(c.orderItemId.toString()));

    return {
      canReview: Boolean(unreviewedItem),
      eligible: Boolean(unreviewedItem),
      hasDeliveredPurchase: true,
      alreadyReviewed: existingReviews.length > 0,
      hasExistingReview: existingReviews.length > 0,
      eligibleOrderItem: unreviewedItem || null,
      userReview: existingReviews.length > 0 ? existingReviews[0] : null,
      existingReview: existingReviews.length > 0 ? existingReviews[0] : null,
      eligiblePurchases: candidateItems
    };
  }

  /**
   * Customer: Update own review
   */
  static async updateReview(reviewId, userId, { rating, title, comment }) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError("Review not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // Ownership check (IDOR defense)
    if (review.userId.toString() !== userId.toString()) {
      throw new AppError(
        "You do not possess permission to modify this review.",
        HTTP_CODES.FORBIDDEN,
        ERROR_CODES.FORBIDDEN
      );
    }

    if (rating !== undefined) {
      review.rating = Math.round(rating);
    }
    if (title !== undefined) {
      review.title = sanitizeText(title);
    }
    if (comment !== undefined) {
      review.comment = sanitizeText(comment);
    }

    await review.save();

    return Review.findById(reviewId).populate("userId", "name").lean();
  }

  /**
   * Customer: Delete own review
   */
  static async deleteReview(reviewId, userId) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError("Review not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // Ownership check (IDOR defense)
    if (review.userId.toString() !== userId.toString()) {
      throw new AppError(
        "You do not possess permission to delete this review.",
        HTTP_CODES.FORBIDDEN,
        ERROR_CODES.FORBIDDEN
      );
    }

    await review.deleteOne();
    return true;
  }

  /**
   * Aggregate single product rating summary and 1-5 star distribution
   */
  static async getProductRatingSummary(productId) {
    const prodId = new mongoose.Types.ObjectId(productId);
    const result = await Review.aggregate([
      {
        $match: {
          productId: prodId,
          status: "PUBLISHED"
        }
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          star5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          star4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          star3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          star2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          star1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }
        }
      }
    ]);

    if (!result || result.length === 0) {
      return {
        average: 0,
        count: 0,
        distribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0
        }
      };
    }

    const data = result[0];
    return {
      average: Math.round(data.averageRating * 10) / 10,
      count: data.totalReviews,
      distribution: {
        5: data.star5,
        4: data.star4,
        3: data.star3,
        2: data.star2,
        1: data.star1
      }
    };
  }

  /**
   * Batch rating summary aggregation for product catalog listings
   */
  static async getBatchRatingSummaries(productIds) {
    if (!productIds || productIds.length === 0) return {};
    const ids = productIds.map((id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)));

    const results = await Review.aggregate([
      {
        $match: {
          productId: { $in: ids },
          status: "PUBLISHED"
        }
      },
      {
        $group: {
          _id: "$productId",
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" }
        }
      }
    ]);

    const summaryMap = {};
    for (const r of results) {
      summaryMap[r._id.toString()] = {
        average: Math.round(r.averageRating * 10) / 10,
        count: r.totalReviews
      };
    }
    return summaryMap;
  }

  /**
   * Admin: Query all reviews with moderation filters and pagination
   */
  static async getAdminReviews({ page = 1, limit = 10, status = "ALL", rating, search } = {}) {
    const query = {};

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (rating !== undefined && rating !== null) {
      query.rating = Number(rating);
    }

    if (search && search.trim()) {
      const trimmed = search.trim();
      query.$or = [
        { title: { $regex: trimmed, $options: "i" } },
        { comment: { $regex: trimmed, $options: "i" } }
      ];
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [total, reviews] = await Promise.all([
      Review.countDocuments(query),
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("userId", "name email")
        .populate("productId", "name slug images")
        .lean()
    ]);

    return {
      reviews,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
        hasNextPage: safePage * safeLimit < total,
        hasPrevPage: safePage > 1
      }
    };
  }

  /**
   * Admin: Update moderation status (PUBLISHED | HIDDEN)
   */
  static async updateReviewStatus(reviewId, status) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError("Review not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    review.status = status;
    await review.save();

    return Review.findById(reviewId)
      .populate("userId", "name email")
      .populate("productId", "name slug images")
      .lean();
  }

  /**
   * Admin: Permanently delete a review
   */
  static async deleteReviewAdmin(reviewId) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError("Review not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    await review.deleteOne();
    return true;
  }

  /**
   * Customer: Vote a review as helpful
   */
  static async voteHelpful(reviewId, userId) {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw new AppError("Review not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError("Review not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    if (review.status !== "PUBLISHED") {
      throw new AppError("Review is not accessible.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // Disallow self-voting
    if (review.userId.toString() === userId.toString()) {
      throw new AppError("You cannot vote on your own review.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.BAD_REQUEST);
    }

    // Check if already voted
    const alreadyVoted = review.helpfulVoters && review.helpfulVoters.some((v) => v.toString() === userId.toString());
    if (alreadyVoted) {
      throw new AppError("You have already voted on this review.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.BAD_REQUEST);
    }

    // Concurrency-safe atomic increment
    const updated = await Review.findOneAndUpdate(
      {
        _id: review._id,
        status: "PUBLISHED",
        helpfulVoters: { $ne: userId }
      },
      {
        $addToSet: { helpfulVoters: userId },
        $inc: { helpfulCount: 1 }
      },
      { new: true }
    );

    if (!updated) {
      throw new AppError("You have already voted on this review.", HTTP_CODES.BAD_REQUEST, ERROR_CODES.BAD_REQUEST);
    }

    return {
      helpfulCount: updated.helpfulCount,
      hasVotedHelpful: true
    };
  }
}

module.exports = ReviewService;
