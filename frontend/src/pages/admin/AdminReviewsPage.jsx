import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import StarRating from "../../features/reviews/StarRating";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { useScrollLock } from "../../hooks/useScrollLock";
import {
  MessageSquare,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Package
} from "lucide-react";

/**
 * AdminReviewsPage
 * Central administrative review moderation dashboard.
 * Supports viewing, status filtering, inspection, hiding, publishing, and deleting product reviews.
 */
export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState("");

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Inspection Modal
  const [selectedReview, setSelectedReview] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  useScrollLock(!!selectedReview);

  const fetchAdminReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (statusFilter) params.set("status", statusFilter);
      if (ratingFilter) params.set("rating", ratingFilter);

      const res = await api.get(`/admin/reviews?${params.toString()}`);
      if (res.success && res.data) {
        setReviews(res.data.reviews || []);
        setPagination(res.data.pagination || { total: 0, pages: 1, limit: 10 });
      }
    } catch (err) {
      setError(err.message || "Failed to load reviews for moderation");
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, ratingFilter]);

  useEffect(() => {
    fetchAdminReviews();
  }, [fetchAdminReviews]);

  // Handle status update (PUBLISHED vs HIDDEN)
  const handleToggleStatus = async (review, newStatus) => {
    try {
      setActionLoadingId(review._id);
      const res = await api.patch(`/admin/reviews/${review._id}/status`, {
        status: newStatus
      });
      if (res.success) {
        setActionSuccess(`Review ${newStatus === "HIDDEN" ? "hidden" : "published"} successfully.`);
        if (selectedReview?._id === review._id) {
          setSelectedReview({ ...selectedReview, status: newStatus });
        }
        await fetchAdminReviews();
      }
    } catch (err) {
      alert(err.message || "Failed to update review status");
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionSuccess(""), 3500);
    }
  };

  // Handle permanent deletion
  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("Are you sure you want to permanently delete this review?")) {
      return;
    }
    try {
      setActionLoadingId(reviewId);
      const res = await api.delete(`/admin/reviews/${reviewId}`);
      if (res.success) {
        setActionSuccess("Review permanently removed.");
        if (selectedReview?._id === reviewId) {
          setSelectedReview(null);
        }
        await fetchAdminReviews();
      }
    } catch (err) {
      alert(err.message || "Failed to delete review");
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setActionSuccess(""), 3500);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">
            Customer Product Reviews
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review moderation, authenticity verification, and storefront visibility management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-semibold">
            {pagination.total} Total Reviews
          </span>
        </div>
      </div>

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 animate-fade-in flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Moderation Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { label: "All Reviews", val: "" },
            { label: "Published", val: "PUBLISHED" },
            { label: "Hidden", val: "HIDDEN" }
          ].map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => {
                setStatusFilter(tab.val);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer shrink-0 ${
                statusFilter === tab.val
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rating Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Rating:</span>
          <select
            value={ratingFilter}
            onChange={(e) => {
              setRatingFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-medium text-slate-700 shadow-xs focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      {/* Main Reviews Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Rating & Review</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <p className="mt-2 text-xs">Loading reviews...</p>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No reviews found matching current filter criteria.</p>
                  </td>
                </tr>
              ) : (
                reviews.map((r) => {
                  const isActionLoading = actionLoadingId === r._id;
                  const isHidden = r.status === "HIDDEN";

                  return (
                    <tr
                      key={r._id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isHidden ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Product */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="font-semibold text-slate-900 truncate" title={r.product?.name}>
                          {r.product?.name || "Deleted Product"}
                        </div>
                        {r.product?.slug && (
                          <a
                            href={`/products/${r.product.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline mt-0.5"
                          >
                            <span>View Product</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {r.user?.name || "Customer"}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                          {r.user?.email || "Anonymous"}
                        </div>
                        {r.isVerifiedPurchase && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            <span>Verified</span>
                          </div>
                        )}
                      </td>

                      {/* Rating & Review Content */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="flex items-center gap-1.5">
                          <StarRating rating={r.rating} size="sm" readOnly />
                          <span className="font-bold text-slate-800 text-[11px]">
                            {r.rating}/5
                          </span>
                        </div>
                        {r.title && (
                          <div className="font-semibold text-slate-900 mt-1 line-clamp-1">
                            {r.title}
                          </div>
                        )}
                        <p className="text-slate-600 text-xs mt-0.5 line-clamp-2">
                          {r.comment}
                        </p>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                        {formatDate(r.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                            r.status === "PUBLISHED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect Modal Trigger */}
                          <button
                            type="button"
                            onClick={() => setSelectedReview(r)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                            title="Inspect Review Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Toggle Status */}
                          {r.status === "PUBLISHED" ? (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleToggleStatus(r, "HIDDEN")}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                              title="Hide from customers"
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                              <span>Hide</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleToggleStatus(r, "PUBLISHED")}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                              title="Publish / Unhide"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>Publish</span>
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleDeleteReview(r._id)}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                            title="Delete permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs">
            <div className="text-slate-500">
              Showing page <span className="font-semibold text-slate-800">{page}</span> of{" "}
              <span className="font-semibold text-slate-800">{pagination.pages}</span> ({pagination.total} reviews)
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                disabled={page >= pagination.pages || loading}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Inspection Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl my-auto rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h3 className="font-heading text-base font-bold text-slate-900">
                Review Moderation Inspection
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 uppercase font-mono text-[10px] font-semibold block">
                    Product
                  </span>
                  <span className="font-semibold text-slate-900 text-sm">
                    {selectedReview.product?.name || "Deleted Product"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-mono text-[10px] font-semibold block">
                    Customer
                  </span>
                  <span className="font-semibold text-slate-900 text-sm">
                    {selectedReview.user?.name || "Customer"}
                  </span>
                  <span className="text-slate-500 block">
                    {selectedReview.user?.email || "No email"}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 uppercase font-mono text-[10px] font-semibold block">
                    Order Reference
                  </span>
                  <span className="font-mono text-slate-700">
                    {selectedReview.orderId ? `Order #${selectedReview.orderId}` : "N/A"}
                  </span>
                  <span className="text-slate-400 font-mono text-[10px] block">
                    Item ID: {selectedReview.orderItemId || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-mono text-[10px] font-semibold block">
                    Verification & Status
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedReview.isVerifiedPurchase ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        Verified Purchase
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        Unverified
                      </span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        selectedReview.status === "PUBLISHED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {selectedReview.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <StarRating rating={selectedReview.rating} size="sm" readOnly />
                  <span className="font-bold text-slate-800">
                    {selectedReview.rating} out of 5 stars
                  </span>
                </div>
                {selectedReview.title && (
                  <h4 className="font-heading text-sm font-bold text-slate-900">
                    {selectedReview.title}
                  </h4>
                )}
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 text-slate-700 leading-relaxed text-xs">
                  {selectedReview.comment}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => handleDeleteReview(selectedReview._id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Permanently</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedReview.status === "PUBLISHED" ? (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(selectedReview, "HIDDEN")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Hide Review</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(selectedReview, "PUBLISHED")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Publish Review</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
