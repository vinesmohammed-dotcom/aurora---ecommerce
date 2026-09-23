import React, { useState, useEffect } from "react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import api from "../../services/api";

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Initiate Modal State
  const [showModal, setShowModal] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [customAmountRupees, setCustomAmountRupees] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const fetchRefunds = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      let query = `?page=${page}&limit=10`;
      if (statusFilter) query += `&status=${statusFilter}`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;

      const res = await api.get(`/admin/refunds${query}`);
      if (res.success && res.data) {
        setRefunds(res.data.refunds || []);
        setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
      } else {
        setError(res.message || "Failed to load refund transactions");
      }
    } catch (err) {
      setError(err.message || "Network error fetching refunds");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRefunds(1);
  };

  const handleInitiateRefund = async (e) => {
    e.preventDefault();
    if (!orderId.trim()) {
      setModalError("Please provide a valid 24-character Order ID.");
      return;
    }
    if (reason.trim().length < 3) {
      setModalError("A mandatory refund reason of at least 3 characters is required.");
      return;
    }

    let amountPaise;
    if (customAmountRupees && parseFloat(customAmountRupees) > 0) {
      amountPaise = Math.round(parseFloat(customAmountRupees) * 100);
    }

    try {
      setSubmitting(true);
      setModalError("");
      const payload = {
        orderId: orderId.trim(),
        reason: reason.trim(),
        amount: amountPaise || undefined
      };

      const res = await api.post("/admin/refunds", payload);
      if (res.success) {
        setModalSuccess(
          `Refund ${res.data.refund?.refundNumber || ""} initiated successfully via Razorpay gateway.`
        );
        setTimeout(() => {
          setShowModal(false);
          setOrderId("");
          setCustomAmountRupees("");
          setReason("");
          setModalSuccess("");
          fetchRefunds(1);
        }, 1500);
      } else {
        setModalError(res.message || "Refund dispatch failed");
      }
    } catch (err) {
      setModalError(err.message || "Refund dispatch failed");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (paise) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PROCESSED":
        return <Badge variant="success">Disbursed (Processed)</Badge>;
      case "PENDING":
        return <Badge variant="warning">Pending Gateway</Badge>;
      case "PROCESSING":
        return <Badge variant="info">In Flight</Badge>;
      case "FAILED":
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">
            Razorpay Gateway Refunds & Settlements
          </h1>
          <p className="text-sm text-slate-500">
            Monitor banking reversions, review gateway settlement IDs, and disburse partial/full refunds on captured orders.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setShowModal(true);
            setModalError("");
            setModalSuccess("");
          }}
          className="shadow-sm"
        >
          💳 Initiate Gateway Refund &rarr;
        </Button>
      </div>

      {/* Strict Separation Architecture Banner */}
      <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs space-y-1 border border-slate-800">
        <div className="flex items-center space-x-2 text-emerald-400 font-semibold font-mono uppercase tracking-wider">
          <span>🏛️ Payment Gateway vs. Wallet Separation</span>
        </div>
        <p className="text-slate-400">
          Gateway refunds return captured money through Razorpay back to the customer's original payment instrument (Card / Netbanking / UPI). They do <strong>NOT</strong> create wallet ledger credits. Stored-value goodwill adjustments are administered under Customer Wallets.
        </p>
      </div>

      {/* Filters and Search Bar */}
      <Card className="p-4 border border-slate-200">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[260px]">
            <input
              type="text"
              placeholder="Search by Refund Number, Gateway ID, or Order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">All Gateway Statuses</option>
              <option value="PROCESSED">PROCESSED (Settled)</option>
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <Button type="submit" variant="secondary" size="md">
            Filter
          </Button>

          {(search || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                fetchRefunds(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Clear
            </button>
          )}
        </form>
      </Card>

      {/* Refunds Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-base font-bold font-heading text-slate-900">Gateway Refund Records</h2>
          <span className="text-xs text-slate-400 font-mono">
            {pagination.total} refunds tracked
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-slate-400 text-sm">Synchronizing gateway refund records...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-600 text-sm">{error}</div>
        ) : refunds.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No gateway refunds found matching current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6">Refund ID / Gateway Ref</th>
                  <th className="py-3 px-6">Order Reference</th>
                  <th className="py-3 px-6">Type</th>
                  <th className="py-3 px-6 text-right">Amount (₹)</th>
                  <th className="py-3 px-6 text-right">Paise</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Reason</th>
                  <th className="py-3 px-6">Disbursed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refunds.map((rf) => (
                  <tr key={rf._id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-6">
                      <div className="font-mono text-xs font-bold text-slate-900">
                        {rf.refundNumber}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {rf.gatewayRefundId || "Pending Gateway ID"}
                      </div>
                    </td>
                    <td className="py-3 px-6 font-mono text-xs text-slate-700">
                      {typeof rf.orderId === "object" ? rf.orderId?.orderNumber || rf.orderId?._id : rf.orderId}
                    </td>
                    <td className="py-3 px-6">
                      <Badge variant={rf.refundType === "FULL" ? "info" : "default"}>
                        {rf.refundType || "FULL"}
                      </Badge>
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-xs font-bold text-rose-600">
                      -{formatCurrency(rf.amount)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-xs text-slate-400">
                      {rf.amount}
                    </td>
                    <td className="py-3 px-6">
                      {getStatusBadge(rf.status)}
                    </td>
                    <td className="py-3 px-6 text-xs text-slate-600 max-w-xs truncate">
                      {rf.reason}
                    </td>
                    <td className="py-3 px-6 text-xs text-slate-400 font-mono">
                      {formatDate(rf.processedAt || rf.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchRefunds(pagination.page - 1)}
              >
                &larr; Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchRefunds(pagination.page + 1)}
              >
                Next &rarr;
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Initiate Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold font-heading text-slate-900 mb-1">
              Initiate Gateway Refund
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Disburse money via Razorpay to the customer's source payment method.
            </p>

            {modalSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs mb-4">
                ✓ {modalSuccess}
              </div>
            )}

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs mb-4">
                {modalError}
              </div>
            )}

            <form onSubmit={handleInitiateRefund} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Order ID (24-char ObjectId)
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  required
                  placeholder="e.g. 6ab3a185f8e8d38ca6e16876"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Refund Amount (Optional, in ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={customAmountRupees}
                    onChange={(e) => setCustomAmountRupees(e.target.value)}
                    placeholder="Leave blank for full remaining balance"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  If empty, the full un-refunded captured order amount will be refunded.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Refund (Mandatory)
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="e.g. Customer returned defective item; passed inspection"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Processing with Razorpay..." : "Execute Gateway Refund"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
