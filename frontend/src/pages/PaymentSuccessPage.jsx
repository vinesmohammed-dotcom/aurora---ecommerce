import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { formatCurrency } from "../utils/formatCurrency";
import { formatDate } from "../utils/formatDate";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");
  const paymentId = searchParams.get("paymentId");

  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setError("No order identifier provided.");
      setIsLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        setIsLoading(true);
        // Fetch order details
        const orderRes = await api.get(`/orders/${orderId}`);
        if (orderRes.success && orderRes.data?.order) {
          setOrder(orderRes.data.order);
        }

        // Fetch payment details if available
        try {
          const payRes = await api.get(`/payments/order/${orderId}`);
          if (payRes.success && payRes.data) {
            setPayment(payRes.data);
          }
        } catch {
          // Payment record query is non-blocking if payment was COD
        }
      } catch (err) {
        setError(err.message || "Failed to load order confirmation.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl py-16 px-4 animate-pulse space-y-6">
        <div className="h-16 w-16 bg-emerald-100 rounded-full mx-auto" />
        <div className="h-8 w-64 bg-slate-200 rounded mx-auto" />
        <div className="h-44 bg-white rounded-2xl border border-slate-200" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg py-16 px-4 text-center space-y-4">
        <div className="h-16 w-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">Order Status Update</h1>
        <p className="text-sm text-slate-600">{error || "Unable to find the requested order."}</p>
        <Link to="/orders">
          <Button variant="primary">View My Orders</Button>
        </Link>
      </div>
    );
  }

  const items = order.items || [];
  const address = order.shippingAddress || {};
  const summary = order.priceSummary || {};
  const isOnline = order.paymentMethod === "ONLINE_RAZORPAY";
  const displayPaymentId = paymentId || payment?.gatewayPaymentId || "Verified";

  return (
    <div className="mx-auto max-w-3xl py-12 px-4 space-y-8">
      {/* Header Celebration Card */}
      <div className="text-center space-y-3">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50 mb-2">
          <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-slate-900">
          Payment Successful & Order Confirmed!
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Thank you for your purchase. We've received your payment and our warehouse team is preparing your shipment.
        </p>
      </div>

      {/* Transaction & Order Identity Card */}
      <Card className="p-6 space-y-4 bg-gradient-to-br from-white to-slate-50/50 border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-100 pb-4 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Order Number</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{order.orderNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Date Placed</span>
            <span className="font-semibold text-slate-800">{formatDate(order.createdAt)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Payment Method</span>
            <Badge variant="info">
              {isOnline ? "Razorpay Online" : "Cash on Delivery"}
            </Badge>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Payment Status</span>
            <Badge variant={order.paymentStatus === "COMPLETED" ? "success" : "info"}>
              {order.paymentStatus}
            </Badge>
          </div>
        </div>

        {isOnline && (
          <div className="bg-indigo-50/60 rounded-xl p-3 flex items-center justify-between text-xs text-indigo-900 border border-indigo-100">
            <div className="flex items-center gap-2">
              <span>🔒</span>
              <span className="font-medium">Gateway Payment ID:</span>
              <span className="font-mono font-bold">{displayPaymentId}</span>
            </div>
            <span className="text-[11px] text-indigo-700 bg-white/80 px-2 py-0.5 rounded border border-indigo-200">
              HMAC Verified
            </span>
          </div>
        )}
      </Card>

      {/* Order Line Items Review */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-bold font-heading text-slate-900 border-b border-slate-100 pb-3">
          Purchased Items ({items.length})
        </h2>

        <div className="divide-y divide-slate-100">
          {items.map((item, idx) => (
            <div key={item.variantId || idx} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">No Img</div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">{item.name}</h4>
                  <p className="text-xs text-slate-500">
                    SKU: {item.sku} • Qty: {item.quantity}
                  </p>
                  {item.offer && (
                    <Badge variant="success" className="mt-1 text-[10px]">
                      ⚡ {item.offer.discountPercentage}% OFF
                    </Badge>
                  )}
                </div>
              </div>

              <div className="text-right font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(item.itemTotal)}
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Summary */}
        <div className="border-t border-slate-100 pt-4 space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Items Subtotal:</span>
            <span className="font-semibold text-slate-800">{formatCurrency(summary.grossSubtotal)}</span>
          </div>
          {summary.offerDiscountTotal > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Promotional Discount:</span>
              <span>-{formatCurrency(summary.offerDiscountTotal)}</span>
            </div>
          )}
          {summary.couponDiscount > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Coupon Discount:</span>
              <span>-{formatCurrency(summary.couponDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Delivery Fee:</span>
            <span>{summary.shippingFee === 0 ? "FREE" : formatCurrency(summary.shippingFee)}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-bold text-slate-900">
            <span>Total Paid:</span>
            <span className="font-mono text-indigo-600 text-lg">{formatCurrency(summary.grandTotal)}</span>
          </div>
        </div>
      </Card>

      {/* Shipping Address */}
      <Card className="p-6 space-y-2">
        <h3 className="text-sm font-bold font-heading text-slate-900">Delivery Destination</h3>
        <p className="text-sm font-semibold text-slate-800">{address.fullName} ({address.phone})</p>
        <p className="text-xs text-slate-600">
          {address.addressLine1}
          {address.addressLine2 ? `, ${address.addressLine2}` : ""}, {address.city}, {address.state} - {address.postalCode}, {address.country}
        </p>
      </Card>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <Link to="/orders">
          <Button variant="primary" size="lg" className="w-full sm:w-auto px-8">
            View My Orders
          </Button>
        </Link>
        <Link to="/shop">
          <Button variant="secondary" size="lg" className="w-full sm:w-auto px-8">
            Continue Shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}
