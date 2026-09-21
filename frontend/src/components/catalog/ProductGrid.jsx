import React from "react";
import ProductCard from "./ProductCard";
import { SearchX, AlertTriangle } from "lucide-react";

export default function ProductGrid({ products, isLoading, error, onResetFilters }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xs animate-pulse"
          >
            <div className="aspect-square w-full rounded-lg bg-slate-200" />
            <div className="mt-4 h-4 w-1/3 rounded bg-slate-200" />
            <div className="mt-2 h-5 w-3/4 rounded bg-slate-200" />
            <div className="mt-6 flex items-center justify-between">
              <div className="h-6 w-1/3 rounded bg-slate-200" />
              <div className="h-8 w-16 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-12 text-center">
        <AlertTriangle className="h-12 w-12 text-rose-500 mb-3" />
        <h3 className="text-lg font-semibold text-rose-900">Failed to load catalog</h3>
        <p className="mt-1 text-sm text-rose-600 max-w-md">{error}</p>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
          <SearchX className="h-8 w-8 stroke-[1.5]" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">No products found</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm">
          We couldn't find any products matching your active search and filter criteria.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-600"
          >
            Clear All Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} />
      ))}
    </div>
  );
}
