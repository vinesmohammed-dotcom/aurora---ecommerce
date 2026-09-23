import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { launchRazorpayModal } from "../utils/razorpay";
import { formatCurrency } from "../utils/formatCurrency";

export default function PaymentFailurePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");
  const failureReason = searchParams.get("reason") || "The payment session was cancelled or declined by your bank.";

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/orders/${orderId}`);
        if (res.success && res.data?.order) {
          setOrder(res.data.order);
        }
      } catch (err) {
        setErrorMessage(err.message || "Failed to retrieve order information.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleRetryPayment = async () => {
    if (!orderId) return;

    try {
      setIsRetrying(true);
      setErrorMessage("");

      // 1. Request new gateway order for existing internal order
      const retryRes = await api.post("/payments/retry", { orderId });

      if (!retryRes.success || !retryRes.data?.checkoutInfo) {
        throw new Error(retryRes.message || "Failed to initialize payment retry session.");
      }

      const checkoutInfo = retryRes.data.checkoutInfo;

      // 2. Open Razorpay Checkout Modal
      await launchRazorpayModal({
        checkoutInfo,
        onSuccess: async (response) => {
          try {
            // Verify signature on server
            const verifyRes = await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyRes.success) {
              navigate(`/payment-success?orderId=${orderId}&paymentId=${response.razorpay_payment_id}`);
            } else {
              setErrorMessage("Signature verification failed. Please check My Orders for update.");
            }
          } catch (verifyErr) {
            setErrorMessage(verifyErr.message || "Payment verification failed.");
          }
        },
        onFailure: (errResponse) => {
          setErrorMessage(errResponse?.error?.description || "Payment attempt failed. You can try again.");
        },
        onDismiss: () => {
          // Modal dismissed, user stays on failure page
        }
      });
    } catch (err) {
      setErrorMessage(err.message || "Payment retry encountered an issue.");
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl py-16 px-4 animate-pulse space-y-6 text-center">
        <div className="h-16 w-16 bg-rose-100 rounded-full mx-auto" />
        <div className="h-8 w-48 bg-slate-200 rounded mx-auto" />
        <div className="h-40 bg-white rounded-2xl border border-slate-200" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-12 px-4 space-y-8">
      {/* Alert Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-8 ring-rose-50 mb-2">
          <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-slate-900">
          Payment Was Not Completed
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {failureReason}
        </p>
      </div>

      {/* Inventory Protection Reassurance Banner */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 flex items-start gap-3">
        <span className="text-lg">🛡️</span>
        <div className="space-y-1">
          <p className="font-bold">Your Items Are Safely Reserved</p>
          <p className="text-amber-800">
            We have securely saved your order and reserved your inventory items. You do not need to rebuild your shopping cart. You can complete payment whenever you are ready.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Order Details Card */}
      {order && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs text-slate-400 font-medium block">Order Number</span>
              <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-medium block">Payable Amount</span>
              <span className="font-mono font-bold text-indigo-600 text-base">
                {formatCurrency(order.priceSummary?.grandTotal)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Payment Status:</span>
            <Badge variant="destructive">{order.paymentStatus || "FAILED"}</Badge>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Reserved Items:</span>
            <span className="font-semibold text-slate-800">{order.items?.length || 0} items</span>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        <Button
          variant="primary"
          size="lg"
          onClick={handleRetryPayment}
          isLoading={isRetrying}
          className="w-full justify-center py-3.5 font-bold shadow-lg shadow-indigo-100 bg-indigo-600 hover:bg-indigo-700"
        >
          ⚡ Retry Payment with Razorpay
        </Button>

        <div className="flex gap-4">
          <Link to="/orders" className="flex-1">
            <Button variant="secondary" size="md" className="w-full justify-center">
              View in My Orders
            </Button>
          </Link>
          <Link to="/shop" className="flex-1">
            <Button variant="ghost" size="md" className="w-full justify-center">
              Back to Store
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
