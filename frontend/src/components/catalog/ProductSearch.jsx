import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

export default function ProductSearch({ initialValue = "", onSearch }) {
  const [query, setQuery] = useState(initialValue);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products by title, description..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 shadow-xs transition-colors focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
        />
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </form>
  );
}
