import React from "react";
import StarRating from "./StarRating";
import { BadgeCheck, Calendar, Edit2, Trash2, ChevronLeft, ChevronRight, MessageSquare, ThumbsUp } from "lucide-react";

/**
 * ReviewList component
 * Displays paginated customer reviews with sorting, verified badges, helpful voting, and author management actions.
 */
export default function ReviewList({
  reviews = [],
  pagination = { page: 1, limit: 5, totalPages: 1, total: 0 },
  currentUserId = null,
  sortBy = "newest",
  onSortChange = () => {},
  onPageChange = () => {},
  onEditReview = () => {},
  onDeleteReview = () => {},
  onVoteHelpful = () => {},
  isVotingHelpful = null,
  isLoading = false,
  selectedRatingFilter = null,
  onClearFilter = () => {}
}) {
  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  const getAuthorName = (user) => {
    if (!user) return "Customer";
    if (typeof user === "string") return "Customer";
    if (user.name) return user.name;
    if (user.email) {
      const prefix = user.email.split("@")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return "Customer";
  };

  const getInitials = (name) => {
    if (!name) return "C";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header Bar with Sort and Active Filter Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-lg font-bold text-slate-900">
            Customer Reviews
          </h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {pagination.total}
          </span>
          {selectedRatingFilter && (
            <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              <span>{selectedRatingFilter} Stars</span>
              <button
                type="button"
                onClick={onClearFilter}
                className="hover:text-indigo-900 font-bold ml-1"
                title="Clear rating filter"
              >
                ×
              </button>
            </span>
          )}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="review-sort-select" className="text-slate-500 font-medium">Sort by:</label>
          <select
            id="review-sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-medium text-slate-700 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="newest">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="rating_desc">Highest Rating</option>
            <option value="rating_asc">Lowest Rating</option>
          </select>
        </div>
      </div>

      {/* Loading Overlay or Empty State */}
      {isLoading ? (
        <div className="space-y-4 py-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-slate-100 bg-white p-6 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="h-3 w-16 bg-slate-200 rounded" />
                </div>
              </div>
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-12 w-full bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h4 className="font-heading text-base font-bold text-slate-900">
            {selectedRatingFilter ? "No matching reviews" : "No reviews yet"}
          </h4>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {selectedRatingFilter
              ? `There are no reviews with a ${selectedRatingFilter}-star rating yet.`
              : "Be the first verified customer to share your thoughts on this product!"}
          </p>
          {selectedRatingFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="mt-4 inline-flex items-center rounded-lg bg-white border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Show all reviews
            </button>
          )}
        </div>
      ) : (
        /* Review Cards */
        <div className="space-y-4">
          {reviews.map((review) => {
            const authorName = getAuthorName(review.user);
            const initials = getInitials(authorName);
            const authorId = review.user?._id || review.user;
            const isOwner = currentUserId && String(currentUserId) === String(authorId);

            return (
              <div
                key={review._id}
                className={`rounded-2xl border bg-white p-6 shadow-xs transition-all ${
                  isOwner ? "border-indigo-200 ring-1 ring-indigo-100" : "border-slate-200"
                }`}
              >
                {/* Review Header: User info, Rating, Date & Actions */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-xs text-slate-700 border border-slate-200">
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900">
                          {authorName}
                        </span>
                        {isOwner && (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                            You
                          </span>
                        )}
                        {review.isVerifiedPurchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200/60">
                            <BadgeCheck className="h-3 w-3 text-emerald-600" />
                            <span>Verified Purchase</span>
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <StarRating rating={review.rating} size="sm" readOnly />
                        <span className="text-slate-300">•</span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(review.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Edit/Delete Actions for Review Owner */}
                  {isOwner && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditReview(review)}
                        className="inline-flex items-center gap-1 rounded-lg p-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                        title="Edit Review"
                        aria-label="Edit review"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteReview(review._id)}
                        className="inline-flex items-center gap-1 rounded-lg p-1.5 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                        title="Delete Review"
                        aria-label="Delete review"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Review Body */}
                <div className="mt-4 space-y-1.5 pl-13">
                  {review.title && (
                    <h4 className="font-heading text-sm font-bold text-slate-900">
                      {review.title}
                    </h4>
                  )}
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {review.comment}
                  </p>

                  {/* Helpful Vote Section */}
                  <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-medium">
                        Helpful {review.helpfulCount || 0}
                      </span>
                      {!isOwner && (
                        <button
                          type="button"
                          disabled={review.hasVotedHelpful || isVotingHelpful === review._id}
                          onClick={() => onVoteHelpful(review._id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                            review.hasVotedHelpful
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 cursor-default"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60"
                          }`}
                          title={review.hasVotedHelpful ? "You found this review helpful" : "Mark as helpful"}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          <span>{review.hasVotedHelpful ? "Helpful ✓" : "Helpful"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
          <div className="text-slate-500">
            Page <span className="font-medium text-slate-900">{pagination.page}</span> of{" "}
            <span className="font-medium text-slate-900">{pagination.totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => onPageChange(pagination.page - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => onPageChange(pagination.page + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
