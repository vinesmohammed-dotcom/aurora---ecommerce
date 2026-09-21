import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import api from "../services/api";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    productsCount: 0,
    categoriesCount: 0,
    brandsCount: 0,
    loading: true
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [pRes, cRes, bRes] = await Promise.allSettled([
          api.get("/products/admin/all?limit=1"),
          api.get("/categories?limit=1"),
          api.get("/brands?limit=1")
        ]);

        setStats({
          productsCount: pRes.status === "fulfilled" && pRes.value.success ? pRes.value.data.pagination.total : 0,
          categoriesCount: cRes.status === "fulfilled" && cRes.value.success ? cRes.value.data.pagination.total : 0,
          brandsCount: bRes.status === "fulfilled" && bRes.value.success ? bRes.value.data.pagination.total : 0,
          loading: false
        });
      } catch (err) {
        setStats((prev) => ({ ...prev, loading: false }));
      }
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Admin Control Center</h1>
          <p className="text-sm text-slate-500">Catalog taxonomy, product variants, inventory, and storefront governance.</p>
        </div>
        <Badge variant="warning">Admin Restricted</Badge>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Catalog Products</p>
          <p className="text-3xl font-bold font-heading text-slate-900 mt-2">
            {stats.loading ? "..." : stats.productsCount}
          </p>
          <div className="mt-2 text-xs text-slate-500">Managed in MongoDB</div>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Categories</p>
          <p className="text-3xl font-bold font-heading text-slate-900 mt-2">
            {stats.loading ? "..." : stats.categoriesCount}
          </p>
          <div className="mt-2 text-xs text-slate-500">Taxonomy hierarchy</div>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Partner Brands</p>
          <p className="text-3xl font-bold font-heading text-slate-900 mt-2">
            {stats.loading ? "..." : stats.brandsCount}
          </p>
          <div className="mt-2 text-xs text-slate-500">Verified manufacturers</div>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform Security</p>
          <p className="text-xl font-bold text-emerald-600 mt-2">Enforced</p>
          <div className="mt-2 text-xs text-slate-500">Role-based Auth guard</div>
        </Card>
      </div>

      {/* Quick Access Modules */}
      <div>
        <h2 className="text-lg font-bold font-heading text-slate-900 mb-4">Catalog Management Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 flex flex-col justify-between hover:shadow-md transition-shadow border border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-lg mb-4">
                🏷️
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Products & Variants</h3>
              <p className="text-sm text-slate-500 mb-4">
                Create products, manage embedded SKU variants, configure prices, cost prices, and stock levels.
              </p>
            </div>
            <Link to="/admin/products">
              <Button variant="primary" size="sm" className="w-full">
                Manage Products &rarr;
              </Button>
            </Link>
          </Card>

          <Card className="p-6 flex flex-col justify-between hover:shadow-md transition-shadow border border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg mb-4">
                📁
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Categories</h3>
              <p className="text-sm text-slate-500 mb-4">
                Define taxonomy, parent-child structures, active states, and storefront browsing navigation.
              </p>
            </div>
            <Link to="/admin/categories">
              <Button variant="secondary" size="sm" className="w-full">
                Manage Categories &rarr;
              </Button>
            </Link>
          </Card>

          <Card className="p-6 flex flex-col justify-between hover:shadow-md transition-shadow border border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg mb-4">
                🏢
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Brands</h3>
              <p className="text-sm text-slate-500 mb-4">
                Configure brand profiles, logo URLs, external websites, and storefront filter associations.
              </p>
            </div>
            <Link to="/admin/brands">
              <Button variant="secondary" size="sm" className="w-full">
                Manage Brands &rarr;
              </Button>
            </Link>
          </Card>

          <Card className="p-6 flex flex-col justify-between hover:shadow-md transition-shadow border border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg mb-4">
                📦
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Customer Orders</h3>
              <p className="text-sm text-slate-500 mb-4">
                Fulfill orders, advance state machine transitions, and monitor deliveries and cancellations.
              </p>
            </div>
            <Link to="/admin/orders">
              <Button variant="primary" size="sm" className="w-full">
                Manage Orders &rarr;
              </Button>
            </Link>
          </Card>

          <Card className="p-6 flex flex-col justify-between hover:shadow-md transition-shadow border border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg mb-4">
                ⚡
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Promotional Offers</h3>
              <p className="text-sm text-slate-500 mb-4">
                Configure product and category discount campaigns with deterministic non-stacking priority.
              </p>
            </div>
            <Link to="/admin/offers">
              <Button variant="secondary" size="sm" className="w-full">
                Manage Offers &rarr;
              </Button>
            </Link>
          </Card>

          <Card className="p-6 flex flex-col justify-between hover:shadow-md transition-shadow border border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-lg mb-4">
                🎟️
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Vouchers & Coupons</h3>
              <p className="text-sm text-slate-500 mb-4">
                Create promotional coupon codes, configure minimum order thresholds, and set usage caps.
              </p>
            </div>
            <Link to="/admin/coupons">
              <Button variant="secondary" size="sm" className="w-full">
                Manage Coupons &rarr;
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
