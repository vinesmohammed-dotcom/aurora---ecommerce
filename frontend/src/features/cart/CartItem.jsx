import React from "react";
import Badge from "../../components/ui/Badge";

export default function CartItem({ item, onUpdateQuantity, onRemove, isUpdating = false }) {
  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  const attributes = item.variantTitle
    ? typeof item.variantTitle === "object"
      ? Object.entries(item.variantTitle).map(([k, v]) => `${k}: ${v}`).join(", ")
      : String(item.variantTitle)
    : "";

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        item.staleStock || !item.isAvailable
          ? "border-amber-300 bg-amber-50/20"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Product Image */}
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
          {item.image ? (
            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
              No Image
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between">
            <h4 className="font-heading text-base font-bold text-slate-900">{item.name}</h4>
            <span className="font-mono text-base font-bold text-slate-900">
              {formatCurrency(item.itemTotal)}
            </span>
          </div>

          {attributes && <p className="text-xs text-slate-500">{attributes}</p>}
          {item.sku && <p className="text-xs font-mono text-slate-400">SKU: {item.sku}</p>}

          <div className="pt-1 text-xs text-slate-600">
            <span>Price: </span>
            <span className="font-semibold text-slate-800">{formatCurrency(item.unitPrice)}</span>
          </div>

          {/* Stale stock or unavailable banner */}
          {(item.staleStock || !item.isAvailable || item.warning) && (
            <div className="mt-2 rounded-md bg-amber-100/70 px-2.5 py-1 text-xs font-medium text-amber-800 flex items-center gap-2">
              <span>⚠️</span>
              <span>{item.warning || item.staleReason || "Warehouse inventory changed"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quantity and Actions Bar */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Qty:</span>
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
            <button
              type="button"
              disabled={isUpdating || item.quantity <= 1}
              onClick={() => onUpdateQuantity(item.variantId, item.quantity - 1)}
              className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              -
            </button>
            <span className="px-3 py-1 text-xs font-semibold text-slate-800 bg-white min-w-[28px] text-center">
              {item.quantity}
            </span>
            <button
              type="button"
              disabled={isUpdating || item.quantity >= 10 || item.quantity >= (item.availableStock || 10)}
              onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1)}
              className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              +
            </button>
          </div>
          <span className="text-[11px] text-slate-400">(Max 10)</span>
        </div>

        <button
          type="button"
          disabled={isUpdating}
          onClick={() => onRemove(item.variantId)}
          className="text-xs font-semibold text-rose-500 hover:text-rose-700 disabled:opacity-40 transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
