import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import { useScrollLock } from "../../hooks/useScrollLock";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  useScrollLock(isModalOpen);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: 10,
    minOrderValue: 500,
    maxDiscount: "",
    expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    usageLimit: "",
    perUserLimit: 1
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/admin/coupons");
      if (res.success) {
        setCoupons(res.data.coupons || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const openCreateModal = () => {
    setFormData({
      code: "",
      description: "",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minOrderValue: 500,
      maxDiscount: "",
      expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      usageLimit: "",
      perUserLimit: 1
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
        code: formData.code.trim().toUpperCase(),
        description: formData.description,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderValue: Number(formData.minOrderValue) || 0,
        maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
        expiryDate: new Date(formData.expiryDate).toISOString(),
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        perUserLimit: Number(formData.perUserLimit) || 1
      };

      const res = await api.post("/admin/coupons", payload);
      if (res.success) {
        closeModal();
        fetchCoupons();
      }
    } catch (err) {
      setFormError(err.message || "Failed to create coupon");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (coupon) => {
    if (!window.confirm(`Delete coupon "${coupon.code}"?`)) return;
    try {
      await api.delete(`/admin/coupons/${coupon._id}`);
      fetchCoupons();
    } catch (err) {
      alert("Failed to delete coupon: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            <Link to="/admin" className="hover:text-primary-600 transition-colors">Admin</Link>
            <span>/</span>
            <span className="text-slate-700">Coupons</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Promotional Coupons</h1>
          <p className="text-sm text-slate-500">Manage promotional voucher codes, minimum carts, and usage caps.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="secondary" size="sm">Dashboard</Button>
          </Link>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            + Create Coupon
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading coupons...</div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 bg-rose-50 border border-rose-200 m-4 rounded-lg">
            {error}
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-base font-medium text-slate-700">No promotional coupons created</p>
            <Button variant="primary" size="sm" className="mt-4" onClick={openCreateModal}>
              Create First Coupon
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Code</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Discount</th>
                  <th className="px-6 py-3.5">Min Order</th>
                  <th className="px-6 py-3.5">Cap / Max</th>
                  <th className="px-6 py-3.5">Redemptions</th>
                  <th className="px-6 py-3.5">Expiry</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {coupons.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{c.code}</td>
                    <td className="px-6 py-4">
                      <Badge variant={c.discountType === "PERCENTAGE" ? "info" : "default"}>
                        {c.discountType}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">
                      {c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    </td>
                    <td className="px-6 py-4 text-xs">₹{c.minOrderValue}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {c.maxDiscount ? `₹${c.maxDiscount}` : "No cap"}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      {c.usedCount} / {c.usageLimit || "∞"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(c.expiryDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(c)}
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
              <h3 className="text-lg font-bold font-heading text-slate-900">New Coupon Code</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-lg font-bold">
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FESTIVE50"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono tracking-wider"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discount Value *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Order Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Discount Cap (₹)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Optional"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Global Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited if blank"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Per-User Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.perUserLimit}
                    onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button type="button" variant="outline" size="sm" onClick={closeModal} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Coupon"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
