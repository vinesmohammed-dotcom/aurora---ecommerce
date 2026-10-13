import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import api from "../../services/api";
import RatingSummary from "./RatingSummary";
import ReviewList from "./ReviewList";
import ReviewFormModal from "./ReviewFormModal";

/**
 * ProductReviewsSection component
 * Encapsulates the entire customer review lifecycle on the product details page:
 * - Aggregate rating score & distribution
 * - Verified review list with pagination, sorting & star filtering
 * - Verified purchase eligibility verification
 * - Create, edit, and delete customer reviews
 */
export default function ProductReviewsSection({ product }) {
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    average: product?.rating?.average || 0,
    count: product?.rating?.count || 0,
    distribution: product?.rating?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    totalPages: 1,
    total: 0
  });

  const [sortBy, setSortBy] = useState("newest");
  const [ratingFilter, setRatingFilter] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState({ type: "", message: "" });

  // Eligibility state
  const [eligibility, setEligibility] = useState({
    eligible: false,
    hasExistingReview: false,
    existingReview: null,
    eligiblePurchases: []
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  // Fetch reviews for this product
  const fetchReviews = useCallback(
    async (page = 1, currentSort = sortBy, currentFilter = ratingFilter) => {
      if (!product?._id) return;
      try {
        setIsLoading(true);
        let url = `/products/${product._id}/reviews?page=${page}&limit=5&sort=${currentSort}`;
        if (currentFilter) {
          url += `&rating=${currentFilter}`;
        }
        const res = await api.get(url);
        if (res.success && res.data) {
          setReviews(res.data.reviews || []);
          if (res.data.summary) {
            setSummary(res.data.summary);
          }
          const paginationData = res.meta || res.data.pagination;
          if (paginationData) {
            setPagination({
              page: paginationData.page || 1,
              limit: paginationData.limit || 5,
              totalPages: paginationData.totalPages || 1,
              total: paginationData.total || 0
            });
          }
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [product?._id, sortBy, ratingFilter]
  );

  // Check eligibility for logged-in user
  const checkEligibility = useCallback(async () => {
    if (!product?._id || !isAuthenticated) {
      setEligibility({
        eligible: false,
        hasExistingReview: false,
        existingReview: null,
        eligiblePurchases: []
      });
      return;
    }

    try {
      const res = await api.get(`/products/${product._id}/reviews/eligibility`);
      if (res.success && res.data) {
        setEligibility(res.data);
      }
    } catch (err) {
      console.error("Failed to verify review eligibility:", err);
    }
  }, [product?._id, isAuthenticated]);

  useEffect(() => {
    fetchReviews(1, sortBy, ratingFilter);
  }, [fetchReviews, sortBy, ratingFilter]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  // Handle write review click
  const handleOpenWriteReview = () => {
    setEditingReview(null);
    setIsModalOpen(true);
  };

  // Handle edit review click
  const handleOpenEditReview = (reviewToEdit) => {
    setEditingReview(reviewToEdit || eligibility.existingReview);
    setIsModalOpen(true);
  };

  // Handle review creation or edit submission
  const handleSubmitReview = async (formData) => {
    if (editingReview?._id) {
      // Update existing review
      const res = await api.put(`/reviews/${editingReview._id}`, {
        rating: formData.rating,
        title: formData.title,
        comment: formData.comment
      });
      if (res.success) {
        setFeedbackNotice({
          type: "success",
          message: "Your review was successfully updated!"
        });
        await fetchReviews(pagination.page);
        await checkEligibility();
      }
    } else {
      // Create new review
      const res = await api.post(`/products/${product._id}/reviews`, {
        rating: formData.rating,
        title: formData.title,
        comment: formData.comment,
        orderItemId: formData.orderItemId
      });
      if (res.success) {
        setFeedbackNotice({
          type: "success",
          message: "Thank you! Your verified review has been published."
        });
        await fetchReviews(1);
        await checkEligibility();
      }
    }

    setTimeout(() => {
      setFeedbackNotice({ type: "", message: "" });
    }, 4500);
  };

  // Handle review deletion
  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("Are you sure you want to remove your review? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await api.delete(`/reviews/${reviewId}`);
      if (res.success) {
        setFeedbackNotice({
          type: "info",
          message: "Your review was removed."
        });
        await fetchReviews(1);
        await checkEligibility();
      }
    } catch (err) {
      alert(err.message || "Failed to delete review.");
    }

    setTimeout(() => {
      setFeedbackNotice({ type: "", message: "" });
    }, 4500);
  };

  // Handle helpful vote
  const [isVotingHelpful, setIsVotingHelpful] = useState(null);

  const handleVoteHelpful = async (reviewId) => {
    if (!isAuthenticated) {
      alert("Please log in to vote on customer reviews.");
      return;
    }

    try {
      setIsVotingHelpful(reviewId);
      const res = await api.post(`/reviews/${reviewId}/helpful`);
      if (res.success && res.data) {
        setReviews((prev) =>
          prev.map((r) =>
            r._id === reviewId
              ? { ...r, helpfulCount: res.data.helpfulCount, hasVotedHelpful: true }
              : r
          )
        );
      }
    } catch (err) {
      alert(err.message || "Failed to mark review as helpful.");
    } finally {
      setIsVotingHelpful(null);
    }
  };

  return (
    <section className="mt-16 border-t border-slate-200 pt-12 space-y-8" aria-label="Customer Reviews">
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
          Ratings & Reviews
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Real customer experiences verified by Aurora order fulfillment
        </p>
      </div>

      {feedbackNotice.message && (
        <div
          className={`rounded-xl p-3.5 text-xs font-semibold animate-fade-in ${
            feedbackNotice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-indigo-50 text-indigo-800 border border-indigo-200"
          }`}
        >
          {feedbackNotice.message}
        </div>
      )}

      {/* Aggregate Rating Summary Card */}
      <RatingSummary
        summary={summary}
        selectedRatingFilter={ratingFilter}
        onSelectRatingFilter={(val) => {
          setRatingFilter(val);
          fetchReviews(1, sortBy, val);
        }}
        canReview={Boolean(eligibility.eligible || eligibility.canReview)}
        hasReviewed={Boolean(eligibility.hasExistingReview || eligibility.alreadyReviewed)}
        onWriteReview={handleOpenWriteReview}
        onEditReview={() => handleOpenEditReview(eligibility.existingReview || eligibility.userReview)}
      />

      {/* Review List & Controls */}
      <ReviewList
        reviews={reviews}
        pagination={pagination}
        currentUserId={user?._id || user?.id}
        sortBy={sortBy}
        onSortChange={(newSort) => {
          setSortBy(newSort);
          fetchReviews(1, newSort, ratingFilter);
        }}
        onPageChange={(newPage) => {
          fetchReviews(newPage, sortBy, ratingFilter);
        }}
        onEditReview={handleOpenEditReview}
        onDeleteReview={handleDeleteReview}
        onVoteHelpful={handleVoteHelpful}
        isVotingHelpful={isVotingHelpful}
        isLoading={isLoading}
        selectedRatingFilter={ratingFilter}
        onClearFilter={() => {
          setRatingFilter(null);
          fetchReviews(1, sortBy, null);
        }}
      />

      {/* Form Modal */}
      <ReviewFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitReview}
        initialData={editingReview}
        eligiblePurchases={eligibility.eligiblePurchases}
        productName={product?.name || "Product"}
      />
    </section>
  );
}
