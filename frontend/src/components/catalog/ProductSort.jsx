import React from "react";
import { ArrowUpDown } from "lucide-react";

const SORT_LABELS = [
  { value: "newest", label: "Newest Arrivals" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" }
];

export default function ProductSort({ currentSort = "newest", onSortChange }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <ArrowUpDown className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sort by:</span>
      </div>
      <select
        value={currentSort}
        onChange={(e) => onSortChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
      >
        {SORT_LABELS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
