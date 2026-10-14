import React, { useState, useEffect } from "react";
import StarRating from "./StarRating";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { useScrollLock } from "../../hooks/useScrollLock";

/**
 * ReviewFormModal component
 * Dialog for submitting a new verified review or updating an existing review.
 */
export default function ReviewFormModal({
  isOpen = false,
  onClose = () => {},
  onSubmit = async () => {},
  initialData = null,
  eligiblePurchases = [],
  productName = "Product"
}) {
  const isEditing = !!initialData?._id;
  useScrollLock(isOpen);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setRating(initialData.rating || 5);
      setTitle(initialData.title || "");
      setComment(initialData.comment || "");
      setOrderItemId(initialData.orderItemId || "");
    } else {
      setRating(5);
      setTitle("");
      setComment("");
      if (eligiblePurchases && eligiblePurchases.length > 0) {
        setOrderItemId(eligiblePurchases[0].orderItemId);
      } else {
        setOrderItemId("");
      }
    }
    setErrors({});
    setSubmitError("");
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};

    if (!rating || rating < 1 || rating > 5) {
      newErrors.rating = "Please select a rating between 1 and 5 stars.";
    }

    if (!title.trim()) {
      newErrors.title = "Review headline is required.";
    } else if (title.trim().length < 3) {
      newErrors.title = "Headline must be at least 3 characters.";
    } else if (title.trim().length > 100) {
      newErrors.title = "Headline cannot exceed 100 characters.";
    }

    if (!comment.trim()) {
      newErrors.comment = "Review description is required.";
    } else if (comment.trim().length < 5) {
      newErrors.comment = "Review description must be at least 5 characters.";
    } else if (comment.trim().length > 1000) {
      newErrors.comment = "Review description cannot exceed 1000 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await onSubmit({
        rating,
        title: title.trim(),
        comment: comment.trim(),
        orderItemId: !isEditing && orderItemId ? orderItemId : undefined
      });
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-lg my-auto rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden transform transition-all max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 id="review-modal-title" className="font-heading text-lg font-bold text-slate-900">
              {isEditing ? "Edit Your Review" : "Write a Customer Review"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {productName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {submitError && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Rating Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Overall Rating <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-3 pt-1">
              <StarRating
                rating={rating}
                readOnly={false}
                onChange={(val) => {
                  setRating(val);
                  if (errors.rating) setErrors((prev) => ({ ...prev, rating: null }));
                }}
                size="lg"
              />
              <span className="text-sm font-semibold text-amber-600 font-heading">
                {rating === 5 && "5 - Excellent"}
                {rating === 4 && "4 - Good"}
                {rating === 3 && "3 - Average"}
                {rating === 2 && "2 - Poor"}
                {rating === 1 && "1 - Terrible"}
              </span>
            </div>
            {errors.rating && <p className="text-xs text-rose-500 mt-1">{errors.rating}</p>}
          </div>

          {/* Order selection if multiple eligible orders exist and creating new review */}
          {!isEditing && eligiblePurchases.length > 1 && (
            <div className="space-y-1">
              <label htmlFor="review-order-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Select Purchase Order
              </label>
              <select
                id="review-order-select"
                value={orderItemId}
                onChange={(e) => setOrderItemId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              >
                {eligiblePurchases.map((purchase) => (
                  <option key={purchase.orderItemId} value={purchase.orderItemId}>
                    Order {purchase.orderNumber} (Delivered {new Date(purchase.deliveredAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label htmlFor="review-title-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Review Headline <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{title.length}/100</span>
            </div>
            <input
              id="review-title-input"
              type="text"
              maxLength={100}
              placeholder="What's most important to know? (e.g. Great sound quality!)"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
              }}
              className={`w-full rounded-xl border py-2.5 px-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                errors.title
                  ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                  : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title}</p>}
          </div>

          {/* Comment */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label htmlFor="review-comment-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Written Review <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{comment.length}/1000</span>
            </div>
            <textarea
              id="review-comment-input"
              rows={4}
              maxLength={1000}
              placeholder="What did you like or dislike? How was the build quality, performance, or value?"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (errors.comment) setErrors((prev) => ({ ...prev, comment: null }));
              }}
              className={`w-full rounded-xl border py-2.5 px-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 leading-relaxed ${
                errors.comment
                  ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                  : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
              }`}
            />
            {errors.comment && <p className="text-xs text-rose-500 mt-1">{errors.comment}</p>}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60 transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isEditing ? "Saving..." : "Submitting..."}</span>
                </>
              ) : (
                <span>{isEditing ? "Update Review" : "Submit Review"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
