import React from "react";
import Button from "../../components/ui/Button";

export default function CartSummary({ subtotal, totalItems, hasStaleItems, onClearCart, isClearing = false }) {
  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h3 className="font-heading text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
        Order Summary
      </h3>

      <div className="space-y-2 text-sm text-slate-600">
        <div className="flex justify-between">
          <span>Items ({totalItems}):</span>
          <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Standard Delivery:</span>
          <span className="text-emerald-600 font-semibold">Free</span>
        </div>
        <div className="border-t border-slate-100 pt-3 flex justify-between text-base font-bold text-slate-900">
          <span>Estimated Total:</span>
          <span className="font-mono text-indigo-600">{formatCurrency(subtotal)}</span>
        </div>
      </div>

      {hasStaleItems && (
        <div className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-800 border border-amber-200">
          ⚠️ Some items in your cart have changed in stock or availability. Please review your cart before checking out.
        </div>
      )}

      <div className="pt-2 space-y-2">
        <div className="relative group">
          <Button
            type="button"
            variant="primary"
            className="w-full justify-center py-3 text-sm font-bold opacity-75 cursor-not-allowed"
            disabled={true}
          >
            Proceed to Checkout
          </Button>
          <p className="mt-1 text-center text-[11px] font-medium text-slate-400">
            🔒 Checkout & Payments will be activated in Phase 5
          </p>
        </div>

        {totalItems > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            disabled={isClearing}
            className="w-full text-center text-xs font-semibold text-slate-500 hover:text-rose-600 py-2 transition-colors disabled:opacity-50"
          >
            {isClearing ? "Clearing..." : "Clear Entire Cart"}
          </button>
        )}
      </div>
    </div>
  );
}
