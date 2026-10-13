import React from "react";
import StarRating from "./StarRating";
import { MessageSquarePlus, Edit3, CheckCircle } from "lucide-react";

/**
 * RatingSummary component
 * Displays aggregate rating score, 1-5 star distribution bars, and action buttons.
 */
export default function RatingSummary({
  summary = { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
  selectedRatingFilter = null,
  onSelectRatingFilter = () => {},
  canReview = false,
  hasReviewed = false,
  onWriteReview = () => {},
  onEditReview = () => {}
}) {
  const { average = 0, count = 0, distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } = summary;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-center">
        {/* Left Column: Overall Score */}
        <div className="md:col-span-4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-6">
          <div className="text-5xl font-extrabold font-heading text-slate-900 tracking-tight">
            {count > 0 ? average.toFixed(1) : "0.0"}
          </div>
          <div className="mt-2">
            <StarRating rating={average} size="md" readOnly />
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-500">
            {count === 0
              ? "No reviews yet"
              : `Based on ${count} verified ${count === 1 ? "review" : "reviews"}`}
          </p>

          {/* Action button in score column for mobile/desktop */}
          <div className="mt-5 w-full">
            {hasReviewed ? (
              <button
                type="button"
                onClick={onEditReview}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit Your Review</span>
              </button>
            ) : canReview ? (
              <button
                type="button"
                onClick={onWriteReview}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span>Write a Review</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Right Column: Rating Distribution Bars */}
        <div className="md:col-span-8 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-slate-700">Rating Breakdown</span>
            {selectedRatingFilter && (
              <button
                type="button"
                onClick={() => onSelectRatingFilter(null)}
                className="text-indigo-600 hover:underline font-medium"
              >
                Clear filter ({selectedRatingFilter} stars)
              </button>
            )}
          </div>

          {[5, 4, 3, 2, 1].map((star) => {
            const starCount = distribution?.[star] || 0;
            const percentage = count > 0 ? Math.round((starCount / count) * 100) : 0;
            const isSelected = selectedRatingFilter === star;

            return (
              <button
                key={star}
                type="button"
                onClick={() =>
                  onSelectRatingFilter(isSelected ? null : star)
                }
                className={`w-full flex items-center gap-3 text-xs rounded-lg px-2 py-1 transition-all text-left ${
                  isSelected
                    ? "bg-indigo-50 ring-1 ring-indigo-300"
                    : "hover:bg-slate-50 cursor-pointer"
                }`}
              >
                <span className="w-12 font-medium text-slate-700 shrink-0">
                  {star} {star === 1 ? "star" : "stars"}
                </span>

                <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSelected ? "bg-indigo-600" : "bg-amber-400"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <span className="w-8 text-right font-mono text-slate-400 shrink-0">
                  {starCount}
                </span>
                <span className="w-10 text-right text-slate-400 font-mono text-[11px] shrink-0">
                  {percentage}%
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
