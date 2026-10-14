import React from "react";
import Button from "../../components/ui/Button";
import { Printer, Download, X, CheckCircle, ShieldCheck } from "lucide-react";

export default function OrderInvoiceModal({ order, onClose }) {
  if (!order) return null;

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(val || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="w-full max-w-3xl my-auto rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-200 print:shadow-none print:max-h-none print:border-none">
        {/* Top Control Bar (Hidden during print) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-200">Official Tax Invoice & Receipt:</span>
            <span className="font-mono text-indigo-300">INV-{order.orderNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close invoice"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-700 bg-white print:p-0">
          {/* Company & Invoice Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                  A
                </div>
                <h1 className="text-xl font-extrabold font-heading text-slate-900 tracking-tight">
                  AURORA STOREFRONT
                </h1>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Aurora Retail & Logistics Private Limited</p>
              <p className="text-[11px] text-slate-500">GSTIN: 29AAAAA0000A1Z5 • CIN: U51909KA2026PTC123456</p>
              <p className="text-[11px] text-slate-500">Sector 4, HSR Layout, Bengaluru, Karnataka 560102, India</p>
              <p className="text-[11px] text-slate-500">Support Desk: support@aurora.local | +91 (080) 4123-5678</p>
            </div>

            <div className="text-left sm:text-right bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-1 border border-indigo-200/60">
                Tax Invoice / Receipt
              </span>
              <p className="font-mono text-sm font-bold text-slate-900">INV-{order.orderNumber}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Order Ref: #{order.orderNumber}</p>
              <p className="text-[11px] text-slate-500">Date: {formatDate(order.createdAt)}</p>
              <p className="text-[11px] text-slate-500">
                Payment: <span className="font-semibold text-slate-800">{order.paymentMethod}</span>
              </p>
              <p className="text-[11px]">
                Status:{" "}
                <span
                  className={`font-semibold ${
                    order.paymentStatus === "COMPLETED" ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {order.paymentStatus === "COMPLETED" ? "PAID" : order.paymentStatus}
                </span>
              </p>
            </div>
          </div>

          {/* Billing & Shipping Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-200 pb-6">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Billed & Shipped To:
              </h3>
              <p className="font-semibold text-slate-900">{order.shippingAddress?.fullName}</p>
              <p className="text-slate-600">{order.shippingAddress?.addressLine1}</p>
              {order.shippingAddress?.addressLine2 && (
                <p className="text-slate-600">{order.shippingAddress?.addressLine2}</p>
              )}
              <p className="text-slate-600">
                {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.postalCode}
              </p>
              <p className="text-slate-600">{order.shippingAddress?.country || "India"}</p>
              <p className="text-slate-600 font-mono text-[11px]">Contact: {order.shippingAddress?.phone}</p>
            </div>

            <div className="space-y-1 sm:text-right">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Fulfillment Logistics:
              </h3>
              <p className="text-slate-600">Dispatched via Aurora Verified Logistics Network</p>
              <p className="text-slate-600">Tracking Milestone: <span className="font-semibold text-slate-800">{order.orderStatus}</span></p>
              <p className="text-slate-500 text-[11px]">Standard transit within 3–5 business days</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Rate</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {order.items?.map((item, index) => (
                  <tr key={item._id || index}>
                    <td className="py-3 px-3 font-mono text-slate-400">{index + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      {item.variantTitle && item.variantTitle !== "Default" && (
                        <p className="text-[11px] text-slate-500">Variant: {item.variantTitle}</p>
                      )}
                      {item.offer && (
                        <span className="text-[10px] text-emerald-700 font-medium">
                          Offer: {item.offer.name} ({item.offer.discountPercentage}% OFF)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold">{item.quantity}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.itemTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculations Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start pt-4 border-t border-slate-200 gap-6">
            <div className="max-w-xs space-y-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>GST Tax Compliant Invoice</span>
              </div>
              <p>
                All prices are inclusive of integrated goods and service taxes where applicable. This is a computer-generated tax invoice and requires no physical signature.
              </p>
            </div>

            <div className="w-full sm:w-72 space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatCurrency(order.priceSummary?.grossSubtotal)}
                </span>
              </div>

              {order.priceSummary?.offerDiscountTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Offer Savings:</span>
                  <span className="font-mono">-{formatCurrency(order.priceSummary?.offerDiscountTotal)}</span>
                </div>
              )}

              {order.priceSummary?.couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon ({order.appliedCoupon?.code || "APPLIED"}):</span>
                  <span className="font-mono">-{formatCurrency(order.priceSummary?.couponDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Shipping & Packaging:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {order.priceSummary?.shippingFee > 0
                    ? formatCurrency(order.priceSummary?.shippingFee)
                    : "FREE"}
                </span>
              </div>

              <div className="border-t-2 border-slate-300 pt-2 flex justify-between font-bold text-sm text-slate-900">
                <span>Grand Total Paid:</span>
                <span className="font-mono text-indigo-700">
                  {formatCurrency(order.priceSummary?.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Back to Orders
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint} className="bg-slate-900 hover:bg-indigo-600">
            <Printer className="h-4 w-4 mr-1.5" />
            <span>Print Invoice</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
