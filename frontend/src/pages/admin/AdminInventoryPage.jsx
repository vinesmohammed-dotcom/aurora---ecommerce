import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import api from "../../services/api";

export default function AdminInventoryPage() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const fetchInventory = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      let query = `?page=${page}&limit=20`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;
      if (lowStockOnly) query += `&lowStockOnly=true`;

      const res = await api.get(`/admin/products/inventory${query}`);
      if (res.success && res.data) {
        setItems(res.data.inventory);
        setPagination(res.data.pagination);
      } else {
        setError(res.message || "Failed to load inventory matrix");
      }
    } catch (err) {
      setError(err.message || "Network error fetching inventory matrix");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowStockOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInventory(1);
  };

  const formatCurrency = (paise) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);

  const lowStockCount = items.filter((i) => i.isLowStock).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Inventory Matrix & Stock Visibility</h1>
          <p className="text-sm text-slate-500">
            Variant-level SKU ledger, warehouse stock balances, cost-price governance, and automated threshold alerts.
          </p>
        </div>
        <Link to="/admin/products">
          <Button variant="secondary" size="sm">
            Manage Catalog Products &rarr;
          </Button>
        </Link>
      </div>

      {/* Operational Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-4 border-l-4 border-l-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Active SKUs</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{pagination.total}</p>
          <p className="text-xs text-slate-400 mt-1">Across all published catalog products</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-rose-500">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Visible Low-Stock Alerts</p>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">{lowStockCount}</p>
          <p className="text-xs text-slate-400 mt-1">Under strict 10-unit minimum buffer</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock Decrement Mode</p>
          <p className="text-sm font-bold text-emerald-700 mt-2">Atomic Reservation</p>
          <p className="text-xs text-slate-400 mt-1">Auto-releases if payment uncaptured</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 border border-slate-200">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[260px]">
            <input
              type="text"
              placeholder="Search by SKU code or product title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
            />
            <span className="font-medium text-rose-700">Show Low-Stock Only (&lt; 10 units)</span>
          </label>

          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>

          {(search || lowStockOnly) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setLowStockOnly(false);
                fetchInventory(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Clear Filters
            </button>
          )}
        </form>
      </Card>

      {/* Inventory Matrix Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-base font-bold font-heading text-slate-900">Variant Inventory Records</h2>
          <span className="text-xs text-slate-400 font-mono">
            Displaying {items.length} of {pagination.total} variants
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-slate-400 text-sm">Inspecting warehouse variant balances...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-600 text-sm">{error}</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No variant SKUs found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6">SKU Code</th>
                  <th className="py-3 px-6">Product & Attributes</th>
                  <th className="py-3 px-6">Taxonomy</th>
                  <th className="py-3 px-6 text-right">Cost Price</th>
                  <th className="py-3 px-6 text-right">Selling Price</th>
                  <th className="py-3 px-6 text-center">Stock Level</th>
                  <th className="py-3 px-6 text-right">Catalog Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-6 font-mono text-xs font-bold text-slate-900">
                      {item.sku}
                    </td>
                    <td className="py-3 px-6">
                      <div className="font-semibold text-slate-900">{item.productTitle}</div>
                      {item.attributes && Object.keys(item.attributes).length > 0 && (
                        <div className="text-xs text-slate-500 flex flex-wrap gap-1 mt-0.5">
                          {Object.entries(item.attributes).map(([k, v]) => (
                            <span key={k} className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-6 text-xs text-slate-500">
                      <div>{item.category?.name || "General"}</div>
                      <div className="text-slate-400">{item.brand?.name || "Generic"}</div>
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-xs text-slate-500">
                      {formatCurrency(item.costPricePaise)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-xs font-semibold text-slate-900">
                      {formatCurrency(item.pricePaise)}
                    </td>
                    <td className="py-3 px-6 text-center">
                      <div className="inline-flex items-center space-x-2">
                        <span
                          className={`font-bold font-mono text-sm ${
                            item.isLowStock ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {item.stock}
                        </span>
                        {item.isLowStock && (
                          <Badge variant="danger" className="text-[10px] uppercase">
                            Low
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <Badge variant={item.isActive ? "success" : "default"}>
                        {item.isActive ? "Active" : "Archived"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchInventory(pagination.page - 1)}
              >
                &larr; Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchInventory(pagination.page + 1)}
              >
                Next &rarr;
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
