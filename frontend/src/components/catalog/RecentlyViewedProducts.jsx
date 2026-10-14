import React from "react";
import { Link } from "react-router-dom";
import ProductCard from "./ProductCard";
import { History, Trash2 } from "lucide-react";

export default function RecentlyViewedProducts({ items = [], onClear, currentProductId }) {
  // Filter out current product if viewing on detail page
  const displayItems = currentProductId
    ? items.filter((item) => item._id !== currentProductId)
    : items;

  if (!displayItems || displayItems.length === 0) {
    return null;
  }

  return (
    <section className="pt-10 border-t border-slate-200" aria-labelledby="recently-viewed-title">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h2 id="recently-viewed-title" className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
              Recently Viewed
            </h2>
            <p className="text-xs text-slate-500">Pick up where you left off</p>
          </div>
        </div>

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 transition"
            title="Clear browsing history"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {displayItems.slice(0, 4).map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
}
