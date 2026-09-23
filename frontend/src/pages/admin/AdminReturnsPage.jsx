import React, { useState, useEffect } from "react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import api from "../../services/api";

const RETURN_STATUSES = [
  "RETURN_REQUESTED",
  "RETURN_APPROVED",
  "RETURN_RECEIVED",
  "RETURNED"
];

export default function AdminReturnsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("RETURN_REQUESTED");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Review Modal State
  const [reviewOrder, setReviewOrder] = useState(null);
  const [decision, setDecision] = useState("APPROVED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Inspect Modal State
  const [inspectOrder, setInspectOrder] = useState(null);
  const [inspectionPassed, setInspectionPassed] = useState(true);
  const [restock, setRestock] = useState(true);
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [inspecting, setInspecting] = useState(false);

  // Action feedback
  const [actionMessage, setActionMessage] = useState(null);

  const fetchOrders = async (targetStatus = selectedStatus, targetPage = 1) => {
    try {
      setLoading(true);
      setError(null);
      const query = targetStatus ? `?status=${targetStatus}&page=${targetPage}&limit=10` : `?page=${targetPage}&limit=10`;
      const res = await api.get(`/admin/orders${query}`);
      if (res.success && res.data) {
        setOrders(res.data.orders);
        setPagination({
          total: res.data.pagination.total,
          pages: res.data.pagination.pages
        });
      } else {
        setError(res.message || "Failed to load orders");
      }
    } catch (err) {
      setError(err.message || "Network error fetching returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(selectedStatus, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, page]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewOrder) return;
    try {
      setReviewing(true);
      const res = await api.post(`/admin/orders/${reviewOrder._id}/return/review`, {
        decision,
        rejectionReason: decision === "REJECTED" ? rejectionReason : undefined
      });
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Return request ${decision.toLowerCase()} for order ${reviewOrder.orderNumber}`
        });
        setReviewOrder(null);
        fetchOrders(selectedStatus, page);
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to review return" });
    } finally {
      setReviewing(false);
    }
  };

  const handleMarkReceived = async (order) => {
    if (!window.confirm(`Confirm warehouse physical package receipt for order ${order.orderNumber}?`)) return;
    try {
      const res = await api.post(`/admin/orders/${order._id}/return/receive`);
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Order ${order.orderNumber} marked as RETURN_RECEIVED.`
        });
        fetchOrders(selectedStatus, page);
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to mark as received" });
    }
  };

  const handleInspectSubmit = async (e) => {
    e.preventDefault();
    if (!inspectOrder) return;
    try {
      setInspecting(true);
      const res = await api.post(`/admin/orders/${inspectOrder._id}/return/inspect`, {
        inspectionPassed,
        restock: inspectionPassed ? restock : false,
        notes: inspectionNotes
      });
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Return inspection completed for ${inspectOrder.orderNumber}. Stock ${
            inspectionPassed && restock ? "restored to inventory" : "not restored"
          }.`
        });
        setInspectOrder(null);
        fetchOrders(selectedStatus, page);
      }
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Inspection submission failed" });
    } finally {
      setInspecting(false);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(val || 0);

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
      case "RETURN_REQUESTED":
        return <Badge variant="warning">Return Requested</Badge>;
      case "RETURN_APPROVED":
        return <Badge variant="info">Return Approved</Badge>;
      case "RETURN_RECEIVED":
        return <Badge variant="info">Package Received</Badge>;
      case "RETURNED":
        return <Badge variant="success">Returned & Inspected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">Return & Restock Management</h1>
        <p className="text-sm text-slate-500">
          Orchestrate multi-step return authorization, physical package intake, quality inspection, and conditioned inventory restocking.
        </p>
      </div>

      {/* Return Lifecycle Architecture Banner */}
      <Card className="p-4 bg-slate-900 text-slate-300 border-none">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2 font-mono">
          Return State Transition Protocol
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700">
            <span className="font-bold text-white block mb-0.5">1. Customer Request</span>
            <span className="text-slate-400">Order moves to RETURN_REQUESTED. Stock untouched.</span>
          </div>
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700">
            <span className="font-bold text-white block mb-0.5">2. Admin Review</span>
            <span className="text-slate-400">Approve RMA. Stock remains unchanged pending arrival.</span>
          </div>
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700">
            <span className="font-bold text-white block mb-0.5">3. Warehouse Intake</span>
            <span className="text-slate-400">Courier drops parcel. Status: RETURN_RECEIVED.</span>
          </div>
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700">
            <span className="font-bold text-emerald-400 block mb-0.5">4. Quality Inspection</span>
            <span className="text-slate-400">Passed? Restock incremented. Failed? Quarantined.</span>
          </div>
        </div>
      </Card>

      {/* Action feedback message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold uppercase tracking-wider underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex border-b border-slate-200 space-x-2">
        {RETURN_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => {
              setSelectedStatus(st);
              setPage(1);
            }}
            className={`py-2 px-4 text-xs font-semibold rounded-t-lg transition-colors ${
              selectedStatus === st
                ? "bg-white border-t border-l border-r border-slate-200 text-emerald-700"
                : "text-slate-500 hover:text-slate-900 bg-slate-50/50"
            }`}
          >
            {st.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Returns Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-base font-bold font-heading text-slate-900">
            Orders in {selectedStatus.replace(/_/g, " ")}
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {pagination.total} orders awaiting this stage
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-slate-400 text-sm">Querying return pipeline...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-600 text-sm">{error}</div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No orders found under {selectedStatus.replace(/_/g, " ")}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6">Order ID</th>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Reason / Notes</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Workflow Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-6 font-mono text-xs font-bold text-slate-900">
                      {ord.orderNumber}
                      <div className="text-[11px] text-slate-400 font-normal">
                        {formatDate(ord.updatedAt || ord.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <div className="text-slate-900 font-medium">{ord.user?.name || "Customer"}</div>
                      <div className="text-xs text-slate-400">{ord.user?.email || "N/A"}</div>
                    </td>
                    <td className="py-3 px-6 text-xs max-w-xs truncate text-slate-700">
                      {ord.returnDetails?.reason || ord.statusHistory?.slice(-1)[0]?.note || "Customer requested return"}
                    </td>
                    <td className="py-3 px-6 font-semibold text-slate-900">
                      {formatCurrency(ord.totalAmount)}
                    </td>
                    <td className="py-3 px-6">
                      {getStatusBadge(ord.orderStatus)}
                    </td>
                    <td className="py-3 px-6 text-right space-x-2">
                      {ord.orderStatus === "RETURN_REQUESTED" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setReviewOrder(ord);
                            setDecision("APPROVED");
                            setRejectionReason("");
                          }}
                        >
                          Review RMA &rarr;
                        </Button>
                      )}

                      {ord.orderStatus === "RETURN_APPROVED" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMarkReceived(ord)}
                        >
                          📦 Mark Received
                        </Button>
                      )}

                      {ord.orderStatus === "RETURN_RECEIVED" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setInspectOrder(ord);
                            setInspectionPassed(true);
                            setRestock(true);
                            setInspectionNotes("");
                          }}
                        >
                          🔍 Inspect & Restock
                        </Button>
                      )}

                      {ord.orderStatus === "RETURNED" && (
                        <span className="text-xs text-emerald-600 font-semibold">
                          Completed ✓
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Review Modal */}
      {reviewOrder && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold font-heading text-slate-900 mb-1">
              Review Return Request
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Order: <span className="font-semibold text-slate-800">{reviewOrder.orderNumber}</span>
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Return Reason
                </label>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700">
                  {reviewOrder.returnDetails?.reason || "No explicit customer note provided."}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Decision
                </label>
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="APPROVED">APPROVE — Accept Return Authorization (RMA)</option>
                  <option value="REJECTED">REJECT — Deny Return Request</option>
                </select>
              </div>

              {decision === "REJECTED" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Rejection Reason (Required)
                  </label>
                  <textarea
                    rows={2}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                    placeholder="e.g. Return request submitted outside the 7-day policy window..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="text-[11px] text-slate-500 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                ⚠️ <span className="font-semibold text-amber-900">Important:</span> Approving an RMA authorizes the customer to ship the item back. It does <strong>NOT</strong> restock warehouse inventory until physical item inspection.
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={reviewing}
                  onClick={() => setReviewOrder(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={decision === "APPROVED" ? "primary" : "danger"}
                  size="sm"
                  type="submit"
                  disabled={reviewing}
                >
                  {reviewing ? "Submitting..." : `Submit ${decision}`}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Inspect Modal */}
      {inspectOrder && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold font-heading text-slate-900 mb-1">
              Quality Inspection & Inventory Disposition
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Inspecting received package for order{" "}
              <span className="font-semibold text-slate-800">{inspectOrder.orderNumber}</span>
            </p>

            <form onSubmit={handleInspectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Inspection Outcome
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInspectionPassed(true)}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition ${
                      inspectionPassed
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    ✓ Inspection PASSED
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectionPassed(false);
                      setRestock(false);
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition ${
                      !inspectionPassed
                        ? "bg-rose-50 border-rose-500 text-rose-800"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    ✕ Inspection FAILED
                  </button>
                </div>
              </div>

              {inspectionPassed && (
                <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={restock}
                    onChange={(e) => setRestock(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">
                      Restock into Sellable Inventory
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Increments warehouse SKU count back into MongoDB atomically
                    </span>
                  </div>
                </label>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Warehouse Inspector Notes
                </label>
                <textarea
                  rows={2}
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="e.g., Unopened retail box, seal intact, verified serial number."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={inspecting}
                  onClick={() => setInspectOrder(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={inspecting}
                >
                  {inspecting ? "Processing..." : "Complete Inspection"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
