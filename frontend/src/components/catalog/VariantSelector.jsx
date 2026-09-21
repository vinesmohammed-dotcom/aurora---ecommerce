import React from "react";
import PriceDisplay from "./PriceDisplay";
import { Check, ShieldAlert } from "lucide-react";

export default function VariantSelector({ variants = [], selectedVariant, onSelectVariant }) {
  if (!variants || variants.length === 0) {
    return <p className="text-sm text-slate-500">No active variants available.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Price & SKU Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400 block">Current Price</span>
          <PriceDisplay price={selectedVariant?.price} className="text-3xl font-extrabold text-slate-900" />
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-slate-400 block">SKU: {selectedVariant?.sku}</span>
          {selectedVariant && (
            <div className="mt-1">
              {selectedVariant.stock > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  <Check className="h-3 w-3" />
                  {selectedVariant.stock > 10 ? "In Stock" : `Only ${selectedVariant.stock} left`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  <ShieldAlert className="h-3 w-3" />
                  Out of Stock
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Variant Pills Selector */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2.5">
          Select Option / Size
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {variants.map((v) => {
            const isSelected = selectedVariant?._id === v._id;
            const isOutOfStock = v.stock <= 0;

            // Format attributes label, e.g. "Color: Black, Size: 42"
            let label = v.sku;
            if (v.attributes && typeof v.attributes === "object") {
              const entries = Object.entries(v.attributes);
              if (entries.length > 0) {
                label = entries.map(([k, val]) => `${k}: ${val}`).join(" | ");
              }
            }

            return (
              <button
                key={v._id}
                type="button"
                onClick={() => onSelectVariant(v)}
                className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/30"
                    : "border-slate-200 bg-white hover:border-slate-300"
                } ${isOutOfStock ? "opacity-60 bg-slate-50" : ""}`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">{label}</span>
                  {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                </div>
                <div className="mt-2 text-xs font-medium text-slate-500">
                  <PriceDisplay price={v.price} className="text-xs font-bold text-slate-700" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
