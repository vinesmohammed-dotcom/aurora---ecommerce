import React, { useState } from "react";
import { Filter, RotateCcw } from "lucide-react";

export default function ProductFilters({
  categories = [],
  brands = [],
  selectedCategory,
  selectedBrand,
  minPrice,
  maxPrice,
  inStock,
  onFilterChange,
  onReset
}) {
  const [localMin, setLocalMin] = useState(minPrice || "");
  const [localMax, setLocalMax] = useState(maxPrice || "");

  const handlePriceApply = (e) => {
    e.preventDefault();
    onFilterChange({
      minPrice: localMin || undefined,
      maxPrice: localMax || undefined
    });
  };

  return (
    <aside className="w-full space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Filter className="h-4 w-4 text-slate-500" />
          <span>Filters</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Categories */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Categories</h4>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          <label
            className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
              !selectedCategory ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>All Categories</span>
            <input
              type="radio"
              name="category"
              className="sr-only"
              checked={!selectedCategory}
              onChange={() => onFilterChange({ category: undefined })}
            />
          </label>
          {categories.map((cat) => (
            <label
              key={cat._id}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                selectedCategory === cat.slug
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{cat.name}</span>
              <input
                type="radio"
                name="category"
                className="sr-only"
                checked={selectedCategory === cat.slug}
                onChange={() => onFilterChange({ category: cat.slug })}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div className="border-t border-slate-100 pt-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Brands</h4>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          <label
            className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
              !selectedBrand ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>All Brands</span>
            <input
              type="radio"
              name="brand"
              className="sr-only"
              checked={!selectedBrand}
              onChange={() => onFilterChange({ brand: undefined })}
            />
          </label>
          {brands.map((b) => (
            <label
              key={b._id}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                selectedBrand === b.slug
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>{b.name}</span>
              <input
                type="radio"
                name="brand"
                className="sr-only"
                checked={selectedBrand === b.slug}
                onChange={() => onFilterChange({ brand: b.slug })}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="border-t border-slate-100 pt-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Price Range (₹)</h4>
        <form onSubmit={handlePriceApply} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min"
              min="0"
              value={localMin}
              onChange={(e) => setLocalMin(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
            />
            <input
              type="number"
              placeholder="Max"
              min="0"
              value={localMax}
              onChange={(e) => setLocalMax(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-100 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-600 hover:text-white transition-colors"
          >
            Apply Price
          </button>
        </form>
      </div>

      {/* Availability Filter */}
      <div className="border-t border-slate-100 pt-5">
        <label className="flex cursor-pointer items-center justify-between text-sm text-slate-700">
          <span className="font-medium">In Stock Only</span>
          <input
            type="checkbox"
            checked={inStock === "true" || inStock === true}
            onChange={(e) => onFilterChange({ inStock: e.target.checked ? "true" : undefined })}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        </label>
      </div>
    </aside>
  );
}
