import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import api from "../../services/api";
import { setCartItemCount } from "../../store/slices/cartSlice";
import { launchRazorpayModal } from "../../utils/razorpay";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [checkoutData, setCheckoutData] = useState(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [pageError, setPageError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ONLINE_RAZORPAY");

  // Generate unique idempotency key once per checkout session
  const [idempotencyKey] = useState(() => `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(amount || 0);

  // Fetch addresses and calculate initial checkout summary
  const loadCheckout = async (addrId = null, coupon = null) => {
    try {
      setIsLoading(true);
      setPageError("");

      // 1. Fetch addresses
      const addrRes = await api.get("/addresses");
      const userAddresses = addrRes.data?.addresses || [];
      setAddresses(userAddresses);

      let activeAddrId = addrId;
      if (!activeAddrId && userAddresses.length > 0) {
        const defaultAddr = userAddresses.find((a) => a.isDefault) || userAddresses[0];
        activeAddrId = defaultAddr._id;
      }
      setSelectedAddressId(activeAddrId || "");

      // 2. Fetch checkout calculation summary from backend
      const summaryRes = await api.post("/checkout/summary", {
        addressId: activeAddrId || undefined,
        couponCode: coupon || appliedCouponCode || undefined
      });

      if (summaryRes.success && summaryRes.data) {
        setCheckoutData(summaryRes.data);
      }
    } catch (err) {
      setPageError(err.message || "Failed to load checkout details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCheckout();
  }, []);

  const handleSelectAddress = async (addrId) => {
    setSelectedAddressId(addrId);
    try {
      const res = await api.post("/checkout/summary", {
        addressId: addrId,
        couponCode: appliedCouponCode || undefined
      });
      if (res.success && res.data) {
        setCheckoutData(res.data);
      }
    } catch (err) {
      setPageError(err.message || "Failed to update address calculation.");
    }
  };

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;

    try {
      setIsApplyingCoupon(true);
      setCouponError("");
      setCouponSuccess("");

      const res = await api.post("/checkout/coupon", {
        couponCode: couponCodeInput.trim().toUpperCase(),
        addressId: selectedAddressId || undefined
      });

      if (res.success && res.data) {
        setCheckoutData(res.data);
        setAppliedCouponCode(res.data.appliedCoupon?.code || couponCodeInput.trim().toUpperCase());
        setCouponSuccess(`Coupon '${couponCodeInput.trim().toUpperCase()}' applied successfully!`);
        setCouponCodeInput("");
      }
    } catch (err) {
      setCouponError(err.message || "Invalid coupon code.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setAppliedCouponCode("");
    setCouponSuccess("");
    setCouponError("");
    try {
      setIsLoading(true);
      const res = await api.post("/checkout/summary", {
        addressId: selectedAddressId || undefined,
        couponCode: null
      });
      if (res.success && res.data) {
        setCheckoutData(res.data);
      }
    } catch (err) {
      setPageError(err.message || "Failed to recalculate checkout.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceCodOrder = async () => {
    if (!selectedAddressId) {
      alert("Please select or add a delivery address.");
      return;
    }

    try {
      setIsPlacingOrder(true);
      setPageError("");

      const res = await api.post("/orders/checkout/cod", {
        addressId: selectedAddressId,
        couponCode: appliedCouponCode || undefined,
        idempotencyKey
      });

      if (res.success && res.data?.order) {
        dispatch(setCartItemCount(0));
        navigate(`/payment-success?orderId=${res.data.order._id}`);
      }
    } catch (err) {
      setPageError(err.message || "Order placement failed. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      alert("Please select or add a delivery address.");
      return;
    }

    if (paymentMethod === "COD") {
      return handlePlaceCodOrder();
    }

    try {
      setIsPlacingOrder(true);
      setPageError("");

      const res = await api.post("/payments/create", {
        addressId: selectedAddressId,
        couponCode: appliedCouponCode || undefined,
        idempotencyKey
      });

      if (!res.success || !res.data?.checkoutInfo) {
        throw new Error(res.message || "Failed to initialize payment session.");
      }

      const checkoutInfo = res.data.checkoutInfo;

      await launchRazorpayModal({
        checkoutInfo,
        onSuccess: async (response) => {
          try {
            const verifyRes = await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyRes.success) {
              dispatch(setCartItemCount(0));
              navigate(`/payment-success?orderId=${checkoutInfo.orderId}&paymentId=${response.razorpay_payment_id}`);
            } else {
              navigate(`/payment-failure?orderId=${checkoutInfo.orderId}&reason=${encodeURIComponent("Payment signature verification failed.")}`);
            }
          } catch (verifyErr) {
            navigate(`/payment-failure?orderId=${checkoutInfo.orderId}&reason=${encodeURIComponent(verifyErr.message || "Verification failed.")}`);
          }
        },
        onFailure: (errResponse) => {
          navigate(`/payment-failure?orderId=${checkoutInfo.orderId}&reason=${encodeURIComponent(errResponse?.error?.description || "Payment attempt declined.")}`);
        },
        onDismiss: () => {
          navigate(`/payment-failure?orderId=${checkoutInfo.orderId}&reason=${encodeURIComponent("Payment modal closed before completing transaction.")}`);
        }
      });
    } catch (err) {
      setPageError(err.message || "Payment initiation failed. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (isLoading && !checkoutData) {
    return (
      <div className="mx-auto max-w-5xl py-12 px-4 animate-pulse space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <div className="h-44 bg-slate-100 rounded-2xl" />
            <div className="h-56 bg-slate-100 rounded-2xl" />
          </div>
          <div className="h-80 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  const items = checkoutData?.items || [];
  const summary = checkoutData?.summary || {};
  const qualifiesForFree = summary.qualifiesForFreeShipping;
  const differenceToFree = summary.freeShippingThreshold - (summary.netSubtotal - (summary.couponDiscount || 0));

  return (
    <div className="mx-auto max-w-5xl py-8 px-4 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link to="/cart" className="hover:text-indigo-600">Cart</Link>
          <span>›</span>
          <span className="text-slate-800 font-semibold">Authoritative Checkout</span>
        </div>
        <h1 className="text-3xl font-bold font-heading text-slate-900">Checkout & Order Review</h1>
      </div>

      {pageError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-bold">Checkout Alert</p>
            <p>{pageError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column: Address & Payment */}
        <div className="md:col-span-2 space-y-6">
          {/* 1. Delivery Address Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  1
                </span>
                <h2 className="text-lg font-bold text-slate-900 font-heading">Delivery Address</h2>
              </div>
              <Link to="/profile" className="text-xs font-semibold text-indigo-600 hover:underline">
                + Manage Addresses
              </Link>
            </div>

            {addresses.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500 space-y-3">
                <p>You have not added any delivery addresses yet.</p>
                <Link to="/profile">
                  <Button variant="primary" size="sm">Add Address in Profile</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr._id;
                  return (
                    <div
                      key={addr._id}
                      onClick={() => handleSelectAddress(addr._id)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start justify-between ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">{addr.fullName}</span>
                          <span className="text-xs text-slate-400">({addr.phone})</span>
                          {addr.isDefault && <Badge variant="info">Default</Badge>}
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {addr.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {addr.addressLine1}
                          {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}, {addr.city}, {addr.state} - {addr.postalCode}, {addr.country}
                        </p>
                      </div>
                      <div className="flex items-center h-5">
                        <input
                          type="radio"
                          name="selectedAddress"
                          checked={isSelected}
                          onChange={() => handleSelectAddress(addr._id)}
                          className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* 2. Items Review */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  2
                </span>
                <h2 className="text-lg font-bold text-slate-900 font-heading">
                  Order Items ({items.length})
                </h2>
              </div>
              <Link to="/cart" className="text-xs font-semibold text-indigo-600 hover:underline">
                Edit Cart
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={`${item.productId}-${item.variantId}`} className="py-3 flex items-center justify-between gap-4">
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
                          ⚡ {item.offer.discountPercentage}% OFF ({item.offer.name})
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      {formatCurrency(item.itemTotal)}
                    </div>
                    {item.offer && (
                      <div className="text-[11px] text-slate-400 line-through">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 3. Payment Method */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                3
              </span>
              <h2 className="text-lg font-bold text-slate-900 font-heading">Payment Method</h2>
            </div>

            <div className="space-y-3">
              {/* Option 1: Razorpay Online Payment */}
              <div
                onClick={() => setPaymentMethod("ONLINE_RAZORPAY")}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start justify-between ${
                  paymentMethod === "ONLINE_RAZORPAY"
                    ? "border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <span className="font-bold text-slate-900 text-sm">Online Payment (Razorpay)</span>
                    <Badge variant="success">Recommended</Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    Pay securely using UPI, Credit/Debit Cards, or NetBanking. Instant verification and guaranteed stock reservation.
                  </p>
                </div>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "ONLINE_RAZORPAY"}
                  onChange={() => setPaymentMethod("ONLINE_RAZORPAY")}
                  className="h-4 w-4 text-indigo-600 mt-1"
                />
              </div>

              {/* Option 2: Cash on Delivery */}
              <div
                onClick={() => setPaymentMethod("COD")}
                className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start justify-between ${
                  paymentMethod === "COD"
                    ? "border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💵</span>
                    <span className="font-bold text-slate-900 text-sm">Cash on Delivery (COD)</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Pay cash or scan courier contactless UPI QR code when your shipment arrives at your doorstep.
                  </p>
                </div>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "COD"}
                  onChange={() => setPaymentMethod("COD")}
                  className="h-4 w-4 text-indigo-600 mt-1"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right column: Coupon & Order Summary */}
        <div className="space-y-6">
          {/* Coupon Redemption Card */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 font-heading">Promotional Coupon</h3>

            {checkoutData?.appliedCoupon ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-800 font-mono">
                      {checkoutData.appliedCoupon.code}
                    </span>
                    <Badge variant="success" className="text-[10px]">Applied</Badge>
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Saved {formatCurrency(checkoutData.appliedCoupon.discountAmount)}!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value)}
                    placeholder="e.g. FESTIVE50"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={isApplyingCoupon || !couponCodeInput.trim()}
                  >
                    {isApplyingCoupon ? "..." : "Apply"}
                  </Button>
                </div>

                {couponError && (
                  <p className="text-xs text-rose-600 font-medium">{couponError}</p>
                )}
                {couponSuccess && (
                  <p className="text-xs text-emerald-600 font-medium">{couponSuccess}</p>
                )}
              </form>
            )}
          </Card>

          {/* Authoritative Price Summary Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 font-heading border-b border-slate-100 pb-3">
              Price Breakdown
            </h3>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Gross Items Subtotal:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(summary.grossSubtotal)}</span>
              </div>

              {summary.offerDiscountTotal > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Promotional Offer Savings:</span>
                  <span>-{formatCurrency(summary.offerDiscountTotal)}</span>
                </div>
              )}

              {summary.couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Coupon Discount:</span>
                  <span>-{formatCurrency(summary.couponDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1">
                <span>Standard Delivery Fee:</span>
                {qualifiesForFree ? (
                  <span className="text-emerald-600 font-bold">FREE</span>
                ) : (
                  <span className="font-semibold text-slate-800">{formatCurrency(summary.shippingFee)}</span>
                )}
              </div>

              {!qualifiesForFree && differenceToFree > 0 && (
                <div className="rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800 border border-amber-200">
                  🚚 Add <span className="font-bold">{formatCurrency(differenceToFree)}</span> more to qualify for <span className="font-bold">FREE Delivery</span>!
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-600 text-lg">
                  {formatCurrency(summary.grandTotal)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || addresses.length === 0}
                isLoading={isPlacingOrder}
                className="w-full justify-center py-3.5 text-sm font-bold shadow-md shadow-indigo-200"
              >
                {isPlacingOrder
                  ? "Processing..."
                  : paymentMethod === "ONLINE_RAZORPAY"
                  ? "Proceed to Online Payment"
                  : "Place Order (Cash on Delivery)"}
              </Button>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                🔒 Safe & encrypted checkout • Authoritative catalog verification
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
