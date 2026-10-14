import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import { useScrollLock } from "../../hooks/useScrollLock";

export default function AdminOffersPage() {
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  useScrollLock(isModalOpen);
  const [formData, setFormData] = useState({
    name: "",
    targetType: "CATEGORY",
    category: "",
    product: "",
    discountPercentage: 10,
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    isActive: true
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/admin/offers");
      if (res.success) {
        setOffers(res.data.offers || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCatalogDropdowns = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get("/categories"),
        api.get("/products?limit=100")
      ]);
      if (catRes.success) setCategories(catRes.data.categories || []);
      if (prodRes.success) setProducts(prodRes.data.products || []);
    } catch {
      // Non-critical fallback
    }
  };

  useEffect(() => {
    fetchOffers();
    fetchCatalogDropdowns();
  }, [fetchOffers]);

  const openCreateModal = () => {
    setFormData({
      name: "",
      targetType: "CATEGORY",
      category: categories[0]?._id || "",
      product: products[0]?._id || "",
      discountPercentage: 10,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      isActive: true
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        targetType: formData.targetType,
        discountPercentage: Number(formData.discountPercentage),
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        isActive: formData.isActive
      };

      if (formData.targetType === "PRODUCT") {
        payload.product = formData.product;
      } else {
        payload.category = formData.category;
      }

      const res = await api.post("/admin/offers", payload);
      if (res.success) {
        closeModal();
        fetchOffers();
      }
    } catch (err) {
      setFormError(err.message || "Failed to create offer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (offer) => {
    if (!window.confirm(`Delete offer "${offer.name}"?`)) return;
    try {
      await api.delete(`/admin/offers/${offer._id}`);
      fetchOffers();
    } catch (err) {
      alert("Failed to delete offer: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            <Link to="/admin" className="hover:text-primary-600 transition-colors">Admin</Link>
            <span>/</span>
            <span className="text-slate-700">Offers</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Promotional Offers</h1>
          <p className="text-sm text-slate-500">Configure product and category discounts with non-stacking resolution.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="secondary" size="sm">Dashboard</Button>
          </Link>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            + Create Offer
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading offers...</div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 bg-rose-50 border border-rose-200 m-4 rounded-lg">
            {error}
          </div>
        ) : offers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-base font-medium text-slate-700">No active promotional offers</p>
            <Button variant="primary" size="sm" className="mt-4" onClick={openCreateModal}>
              Create First Offer
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Offer Name</th>
                  <th className="px-6 py-3.5">Scope</th>
                  <th className="px-6 py-3.5">Target</th>
                  <th className="px-6 py-3.5">Discount</th>
                  <th className="px-6 py-3.5">Valid Until</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {offers.map((offer) => (
                  <tr key={offer._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{offer.name}</td>
                    <td className="px-6 py-4">
                      <Badge variant={offer.targetType === "PRODUCT" ? "info" : "default"}>
                        {offer.targetType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700">
                      {offer.targetType === "PRODUCT"
                        ? offer.product?.name || "Product"
                        : offer.category?.name || "Category"}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-600">
                      {offer.discountPercentage}%
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(offer.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={offer.isActive ? "success" : "default"}>
                        {offer.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(offer)}
                        className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-2 py-1 rounded hover:bg-rose-50"
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
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full my-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <h3 className="text-lg font-bold font-heading text-slate-900">New Promotional Offer</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Offer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Flash Deal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Scope *</label>
                <select
                  value={formData.targetType}
                  onChange={(e) => setFormData({ ...formData, targetType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="CATEGORY">Category Discount</option>
                  <option value="PRODUCT">Product Discount</option>
                </select>
              </div>

              {formData.targetType === "CATEGORY" ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Product *</label>
                  <select
                    value={formData.product}
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Discount Percentage (1 - 90%) *</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  required
                  value={formData.discountPercentage}
                  onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={closeModal} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Offer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
