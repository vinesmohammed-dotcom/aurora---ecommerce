import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import { useScrollLock } from "../../hooks/useScrollLock";

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  useScrollLock(isModalOpen);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logo: "",
    website: "",
    isActive: true
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10"
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await api.get(`/brands?${params.toString()}`);
      if (res.success) {
        setBrands(res.data.brands || []);
        setPagination(res.data.pagination || { total: 0, pages: 1, limit: 10 });
      }
    } catch (err) {
      setError(err.message || "Failed to load brands");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBrands();
  };

  const openCreateModal = () => {
    setEditingBrand(null);
    setFormData({
      name: "",
      description: "",
      logo: "",
      website: "",
      isActive: true
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name || "",
      description: brand.description || "",
      logo: brand.logo || "",
      website: brand.website || "",
      isActive: brand.isActive !== undefined ? brand.isActive : true
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBrand(null);
    setFormError(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (editingBrand) {
        // Update
        const res = await api.put(`/brands/${editingBrand._id}`, formData);
        if (res.success) {
          closeModal();
          fetchBrands();
        }
      } else {
        // Create
        const res = await api.post("/brands", formData);
        if (res.success) {
          closeModal();
          fetchBrands();
        }
      }
    } catch (err) {
      setFormError(err.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (brand) => {
    try {
      await api.put(`/brands/${brand._id}`, { isActive: !brand.isActive });
      fetchBrands();
    } catch (err) {
      alert("Failed to toggle status: " + (err.message || "Unknown error"));
    }
  };

  const handleDelete = async (brand) => {
    if (!window.confirm(`Are you sure you want to delete brand "${brand.name}"?`)) return;
    try {
      await api.delete(`/brands/${brand._id}`);
      fetchBrands();
    } catch (err) {
      alert("Failed to delete brand: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            <Link to="/admin" className="hover:text-primary-600 transition-colors">Admin</Link>
            <span>/</span>
            <span className="text-slate-700">Brands</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Brand Management</h1>
          <p className="text-sm text-slate-500">Manage manufacturers, brand identities, and storefront partners.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="secondary" size="sm">Back to Dashboard</Button>
          </Link>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            + Create Brand
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <input
            type="text"
            placeholder="Search brands by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          <Button type="submit" variant="secondary" size="sm">Search</Button>
          {search && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </form>
      </Card>

      {/* Table Section */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading brands...</div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 bg-rose-50 border border-rose-200 m-4 rounded-lg">
            {error}
          </div>
        ) : brands.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-base font-medium text-slate-700">No brands found</p>
            <p className="text-sm mt-1">Get started by creating your first partner brand.</p>
            <Button variant="primary" size="sm" className="mt-4" onClick={openCreateModal}>
              Create Brand
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Brand</th>
                  <th className="px-6 py-3.5">Slug</th>
                  <th className="px-6 py-3.5">Website</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {brands.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {b.logo ? (
                          <img
                            src={b.logo}
                            alt={b.name}
                            className="w-8 h-8 rounded object-contain bg-slate-100 p-0.5 border border-slate-200"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400 uppercase">
                            {b.name.substring(0, 2)}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">{b.name}</div>
                          {b.description && (
                            <div className="text-xs text-slate-400 truncate max-w-xs">{b.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {b.slug}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {b.website ? (
                        <a
                          href={b.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline flex items-center gap-1"
                        >
                          Visit &rarr;
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(b)}
                        title="Click to toggle status"
                        className="cursor-pointer focus:outline-none"
                      >
                        {b.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="neutral">Inactive</Badge>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(b)}
                        className="text-primary-600 hover:text-primary-800 text-xs font-semibold px-2 py-1 rounded hover:bg-primary-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(b)}
                        className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-2 py-1 rounded hover:bg-rose-50 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {brands.length} of {pagination.total} entries
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <span className="px-3 py-1 font-semibold text-slate-700 bg-slate-100 rounded">
                {page} / {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => Math.min(p + 1, pagination.pages))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal for Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full my-auto p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <h3 className="text-lg font-bold font-heading text-slate-900">
                {editingBrand ? "Edit Brand" : "New Brand"}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nike"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Logo URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Brand story or details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="brandIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="brandIsActive" className="text-xs font-semibold text-slate-700 select-none">
                  Active (visible in brand filters)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <Button type="button" variant="outline" size="sm" onClick={closeModal} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? "Saving..." : editingBrand ? "Update Brand" : "Create Brand"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
