import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import api from "../services/api";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";

export default function OrdersPage() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Success alert from recent checkout navigation
  const [checkoutSuccess, setCheckoutSuccess] = useState(location.state?.justOrdered || false);
  const recentOrderNumber = location.state?.orderNumber || "";

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
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError("");
      const res = await api.get("/orders");
      if (res.success && res.data) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load orders.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleOpenCancelModal = (order) => {
    setCancellingOrderId(order._id);
    setCancelReason("Found a better price elsewhere");
  };

  const handleConfirmCancel = async () => {
    if (!cancellingOrderId) return;
    try {
      setIsSubmittingCancel(true);
      const res = await api.post(`/orders/${cancellingOrderId}/cancel`, {
        reason: cancelReason || "Customer cancelled order"
      });

      if (res.success) {
        setCancellingOrderId(null);
        fetchOrders();
      }
    } catch (err) {
      alert(err.message || "Failed to cancel order.");
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl py-8 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-slate-900">Your Orders</h1>
          <p className="text-sm text-slate-500">Track current shipments and view historical invoices.</p>
        </div>
        <Link to="/shop">
          <Button variant="secondary" size="sm">Continue Shopping</Button>
        </Link>
      </div>

      {checkoutSuccess && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white shadow-lg space-y-2 relative overflow-hidden">
          <button
            onClick={() => setCheckoutSuccess(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-lg font-bold"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <h3 className="text-lg font-bold">Order Placed Successfully!</h3>
              <p className="text-xs text-emerald-100">
                Your order <span className="font-mono font-bold">{recentOrderNumber}</span> has been confirmed via Cash on Delivery.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-36 bg-slate-100 rounded-2xl" />
          <div className="h-36 bg-slate-100 rounded-2xl" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">
            📦
          </div>
          <h2 className="text-lg font-bold text-slate-900 font-heading">No Orders Placed Yet</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            When you complete checkout, your order tracking, historical invoices, and status timelines will appear here.
          </p>
          <Link to="/shop">
            <Button variant="primary">Start Shopping</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const canCancel = ["CONFIRMED", "PROCESSING"].includes(order.orderStatus);

            return (
              <Card key={order._id} className="overflow-hidden border border-slate-200">
                {/* Order Header */}
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <span className="text-slate-400 block font-medium">ORDER PLACED</span>
                      <span className="font-semibold text-slate-800">{formatDate(order.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">TOTAL</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(order.priceSummary?.grandTotal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">SHIP TO</span>
                      <span className="font-semibold text-slate-800">
                        {order.shippingAddress?.fullName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-700">
                      #{order.orderNumber}
                    </span>
                    {getStatusBadge(order.orderStatus)}
                  </div>
                </div>

                {/* Order Body */}
                <div className="p-6 space-y-6">
                  <div className="divide-y divide-slate-100">
                    {order.items?.map((item) => (
                      <div key={item._id} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-16 w-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">No Img</div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                            <p className="text-xs text-slate-500">
                              Qty: {item.quantity} • Unit Price: {formatCurrency(item.unitPrice)}
                            </p>
                            {item.offer && (
                              <Badge variant="success" className="mt-1 text-[10px]">
                                ⚡ {item.offer.discountPercentage}% OFF ({item.offer.name})
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="text-right font-mono font-bold text-sm text-slate-900">
                          {formatCurrency(item.itemTotal)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order Footer & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span>Payment:</span>
                      <span className="font-semibold text-slate-800 uppercase">
                        {order.paymentMethod} ({order.paymentStatus})
                      </span>
                      {order.appliedCoupon && (
                        <Badge variant="info">
                          Coupon {order.appliedCoupon.code} (-{formatCurrency(order.appliedCoupon.discountAmount)})
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                      >
                        View Timeline & Details
                      </Button>

                      {canCancel && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleOpenCancelModal(order)}
                        >
                          Cancel Order
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Details & Timeline Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Order Details: #{selectedOrder.orderNumber}
                </h3>
                <p className="text-xs text-slate-500">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Delivery Address Snapshot */}
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Delivery Address Snapshot
                </h4>
                <div className="rounded-xl bg-slate-50 p-3 text-slate-700 space-y-0.5">
                  <p className="font-semibold text-slate-900">{selectedOrder.shippingAddress?.fullName}</p>
                  <p>Phone: {selectedOrder.shippingAddress?.phone}</p>
                  <p>{selectedOrder.shippingAddress?.addressLine1}</p>
                  {selectedOrder.shippingAddress?.addressLine2 && <p>{selectedOrder.shippingAddress?.addressLine2}</p>}
                  <p>
                    {selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} - {selectedOrder.shippingAddress?.postalCode}
                  </p>
                  <p>{selectedOrder.shippingAddress?.country}</p>
                </div>
              </div>

              {/* Status Timeline */}
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Status History Timeline
                </h4>
                <div className="space-y-3 border-l-2 border-indigo-200 ml-2 pl-4 py-1">
                  {selectedOrder.statusHistory?.map((h, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                      <div className="font-bold text-slate-900">{h.status}</div>
                      <div className="text-[11px] text-slate-400">{formatDate(h.changedAt)}</div>
                      {h.note && <div className="text-slate-600 mt-0.5">{h.note}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Final Price Breakdown */}
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Authoritative Price Snapshot
                </h4>
                <div className="rounded-xl bg-slate-50 p-3 space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>Gross Subtotal:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedOrder.priceSummary?.grossSubtotal)}</span>
                  </div>
                  {selectedOrder.priceSummary?.offerDiscountTotal > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Offer Savings:</span>
                      <span>-{formatCurrency(selectedOrder.priceSummary?.offerDiscountTotal)}</span>
                    </div>
                  )}
                  {selectedOrder.priceSummary?.couponDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Coupon Savings:</span>
                      <span>-{formatCurrency(selectedOrder.priceSummary?.couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span>{formatCurrency(selectedOrder.priceSummary?.shippingFee)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-sm text-slate-900">
                    <span>Grand Total:</span>
                    <span className="font-mono text-indigo-600">{formatCurrency(selectedOrder.priceSummary?.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-right">
              <Button variant="secondary" size="sm" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 font-heading">Cancel Order</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to cancel this order? Inventory will be restored immediately.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cancellation Reason</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Found a better price elsewhere">Found a better price elsewhere</option>
                <option value="Ordered by mistake">Ordered by mistake</option>
                <option value="Delivery time is too long">Delivery time is too long</option>
                <option value="Need to change delivery address">Need to change delivery address</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCancellingOrderId(null)}
                disabled={isSubmittingCancel}
              >
                Keep Order
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
              >
                {isSubmittingCancel ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
