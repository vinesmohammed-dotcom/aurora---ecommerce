import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";

const ALLOWED_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURN_REQUESTED: [],
  RETURN_APPROVED: [],
  RETURN_RECEIVED: [],
  RETURN_INSPECTED: [],
  RETURNED: [],
  RETURN_REJECTED: []
};

const getAvailableTransitions = (order) => {
  if (!order) return [];
  if (order.orderStatus === "PENDING") {
    // Online orders that are not completed cannot be advanced to CONFIRMED manually
    if (order.paymentMethod === "ONLINE_RAZORPAY" && order.paymentStatus !== "COMPLETED") {
      return ["CANCELLED"];
    }
    return ["CONFIRMED", "CANCELLED"];
  }
  return ALLOWED_TRANSITIONS[order.orderStatus] || [];
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [submittingStatus, setSubmittingStatus] = useState(false);

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(val || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      case "CONFIRMED":
        return <Badge variant="info">Confirmed</Badge>;
      case "PROCESSING":
        return <Badge variant="warning">Processing</Badge>;
      case "SHIPPED":
        return <Badge variant="info">Shipped</Badge>;
      case "DELIVERED":
        return <Badge variant="success">Delivered</Badge>;
      case "CANCELLED":
        return <Badge variant="danger">Cancelled</Badge>;
      case "RETURN_REQUESTED":
        return <Badge variant="warning">Return Requested</Badge>;
      case "RETURN_APPROVED":
        return <Badge variant="info">Return Approved</Badge>;
      case "RETURN_RECEIVED":
        return <Badge variant="info">Return Received</Badge>;
      case "RETURN_INSPECTED":
        return <Badge variant="warning">Return Inspected</Badge>;
      case "RETURN_REJECTED":
        return <Badge variant="danger">Return Rejected</Badge>;
      case "RETURNED":
        return <Badge variant="neutral">Returned</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20"
      });
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await api.get(`/admin/orders?${params.toString()}`);
      if (res.success) {
        setOrders(res.data.orders || []);
        setPagination(res.data.pagination || { total: 0, pages: 1, limit: 20 });
      }
    } catch (err) {
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOpenStatusModal = (order) => {
    setUpdatingOrderId(order._id);
    const transitions = getAvailableTransitions(order);
    setNewStatus(transitions[0] || "");
    setStatusNote("");
  };

  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!updatingOrderId || !newStatus) return;

    try {
      setSubmittingStatus(true);
      const res = await api.patch(`/admin/orders/${updatingOrderId}/status`, {
        status: newStatus,
        note: statusNote || `Status changed to ${newStatus} by admin`
      });

      if (res.success) {
        setUpdatingOrderId(null);
        fetchOrders();
      }
    } catch (err) {
      alert(err.message || "Failed to update order status");
    } finally {
      setSubmittingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            <Link to="/admin" className="hover:text-primary-600 transition-colors">Admin</Link>
            <span>/</span>
            <span className="text-slate-700">Orders</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Order Management</h1>
          <p className="text-sm text-slate-500">
            Fulfill orders, advance status along the state machine, and track inventory restoration.
          </p>
        </div>
        <Link to="/admin">
          <Button variant="secondary" size="sm">Dashboard</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by order #, customer, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading orders...</div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 bg-rose-50 border border-rose-200 m-4 rounded-lg">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No orders match the current criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Order Number</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Total</th>
                  <th className="px-6 py-3.5">Payment</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((order) => {
                  const allowed = getAvailableTransitions(order);
                  const hasTransitions = allowed.length > 0;

                  return (
                    <tr key={order._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 text-xs">
                        #{order.orderNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 text-xs">
                          {order.shippingAddress?.fullName}
                        </div>
                        <div className="text-[11px] text-slate-400">{order.shippingAddress?.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 text-xs">
                        {formatCurrency(order.priceSummary?.grandTotal)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={order.paymentStatus === "COMPLETED" ? "success" : "default"}>
                          {order.paymentMethod}: {order.paymentStatus}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(order.orderStatus)}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2 py-1 rounded hover:bg-indigo-50"
                        >
                          Details
                        </button>
                        {hasTransitions && (
                          <button
                            onClick={() => handleOpenStatusModal(order)}
                            className="text-amber-600 hover:text-amber-800 text-xs font-semibold px-2 py-1 rounded hover:bg-amber-50"
                          >
                            Advance Status
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Advance Status Modal */}
      {updatingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold font-heading text-slate-900">Update Order State</h3>
            <p className="text-xs text-slate-500">
              Select the next valid lifecycle state in the order state machine.
            </p>

            <form onSubmit={handleUpdateStatusSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  {getAvailableTransitions(
                    orders.find((o) => o._id === updatingOrderId)
                  ).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Transition Note</label>
                <input
                  type="text"
                  placeholder="e.g. Dispatched via Express Logistics #TRK-9817"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUpdatingOrderId(null)}
                  disabled={submittingStatus}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submittingStatus}>
                  {submittingStatus ? "Updating..." : "Confirm Transition"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Snapshot Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 max-h-[85vh] overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Order Snapshot: #{selectedOrder.orderNumber}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 uppercase mb-1">Purchased Items</h4>
              <div className="divide-y divide-slate-100">
                {selectedOrder.items?.map((item) => (
                  <div key={item._id} className="py-2 flex justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-slate-400">SKU: {item.sku} • Qty: {item.quantity}</p>
                    </div>
                    <div className="font-mono font-bold text-slate-800">
                      {formatCurrency(item.itemTotal)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 uppercase mb-1">Shipping Snapshot</h4>
              <p>{selectedOrder.shippingAddress?.fullName} ({selectedOrder.shippingAddress?.phone})</p>
              <p>{selectedOrder.shippingAddress?.addressLine1}, {selectedOrder.shippingAddress?.city}</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 uppercase mb-1">Status Timeline</h4>
              <div className="space-y-1">
                {selectedOrder.statusHistory?.map((h, i) => (
                  <div key={i} className="text-slate-600">
                    <span className="font-semibold">{h.status}</span> — {formatDate(h.changedAt)}
                    {h.note && <span className="italic text-slate-400"> ({h.note})</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t text-right">
              <Button variant="secondary" size="sm" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
