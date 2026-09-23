import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import api from "../../services/api";

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get("/admin/reports/dashboard");
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.message || "Failed to load dashboard metrics");
        }
      } catch (err) {
        setError(err.message || "Network error fetching dashboard metrics");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const formatCurrency = (paise) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getOrderStatusBadge = (status) => {
    switch (status) {
      case "CONFIRMED":
        return <Badge variant="info">Confirmed</Badge>;
      case "PROCESSING":
        return <Badge variant="warning">Processing</Badge>;
      case "SHIPPED":
        return <Badge variant="info">Shipped</Badge>;
      case "DELIVERED":
        return <Badge variant="success">Delivered</Badge>;
      case "CANCELLED":
        return <Badge variant="danger">Cancelled</Badge>;
      case "RETURN_REQUESTED":
        return <Badge variant="warning">Return Req</Badge>;
      case "RETURNED":
        return <Badge variant="danger">Returned</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Aggregating platform intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-rose-200 bg-rose-50 text-center">
        <div className="text-rose-600 font-semibold mb-2">Error loading dashboard</div>
        <p className="text-sm text-rose-500 mb-4">{error}</p>
        <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
          Retry Loading
        </Button>
      </Card>
    );
  }

  const { users, products, orders, financials, recentOrders } = data || {};

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Platform Command Center</h1>
          <p className="text-sm text-slate-500">
            Real-time financial performance, inventory health, order fulfillment pipeline, and customer base metrics.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link to="/admin/reports">
            <Button variant="primary" size="sm" className="shadow-sm">
              📈 Comprehensive Reports &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Financial Metric Cards (Converted from Paise) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-5 border-l-4 border-l-emerald-500 hover:shadow-md transition">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Sales Volume</p>
          <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
            {formatCurrency(financials?.grossSalesPaise)}
          </p>
          <div className="mt-2 flex items-center text-xs text-slate-500 space-x-1">
            <span className="text-emerald-600 font-medium">Eligible Orders</span>
            <span>(Confirmed & Delivered)</span>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-blue-500 hover:shadow-md transition">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Sales Realized</p>
          <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
            {formatCurrency(financials?.netSalesPaise)}
          </p>
          <div className="mt-2 flex items-center text-xs text-slate-500 space-x-1">
            <span>Gross minus settled refunds</span>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-amber-500 hover:shadow-md transition">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Refunds Disbursed</p>
          <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
            {formatCurrency(financials?.refundsPaise)}
          </p>
          <div className="mt-2 flex items-center text-xs text-slate-500 space-x-1">
            <span>Razorpay gateway refunds</span>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-purple-500 hover:shadow-md transition">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Base</p>
          <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
            {users?.total || 0}
          </p>
          <div className="mt-2 text-xs text-slate-500">
            <span className="text-emerald-600 font-semibold">{users?.verified || 0}</span> verified ·{" "}
            <span className="text-rose-600 font-semibold">{users?.blocked || 0}</span> blocked
          </div>
        </Card>
      </div>

      {/* Operational Grids: Fulfillment Pipeline & Inventory Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Fulfillment Pipeline */}
        <Card className="p-6 lg:col-span-2 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold font-heading text-slate-900">Order Fulfillment Pipeline</h2>
            <Link to="/admin/orders" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Manage Orders &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-500">Confirmed</span>
              <p className="text-2xl font-bold text-blue-600 mt-1">{orders?.confirmed || 0}</p>
              <span className="text-[11px] text-slate-400">Ready to pack</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-500">Processing</span>
              <p className="text-2xl font-bold text-amber-600 mt-1">{orders?.processing || 0}</p>
              <span className="text-[11px] text-slate-400">Fulfillment in progress</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-500">Shipped</span>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{orders?.shipped || 0}</p>
              <span className="text-[11px] text-slate-400">In transit</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-500">Delivered</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{orders?.delivered || 0}</p>
              <span className="text-[11px] text-slate-400">Completed cycles</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-600">
            <div>
              <span className="text-slate-400">Total All-Time:</span> <span className="font-semibold text-slate-800">{orders?.total || 0}</span>
            </div>
            <div>
              <span className="text-slate-400">Cancelled:</span> <span className="font-semibold text-rose-600">{orders?.cancelled || 0}</span>
            </div>
            <div>
              <span className="text-slate-400">Return Inquiries:</span> <span className="font-semibold text-amber-600">{orders?.returnRequested || 0}</span>
            </div>
          </div>
        </Card>

        {/* Catalog & Inventory Alert */}
        <Card className="p-6 border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold font-heading text-slate-900">Inventory Status</h2>
              <Link to="/admin/inventory" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                View Matrix &rarr;
              </Link>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Total Products</span>
                <span className="font-bold text-slate-900">{products?.total || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <span className="text-sm text-emerald-800">Active on Storefront</span>
                <span className="font-bold text-emerald-700">{products?.active || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
                <span className="text-sm text-rose-800 flex items-center space-x-1">
                  <span>⚠️ Low Stock Alert</span>
                </span>
                <span className="font-bold text-rose-700">{products?.lowStockVariants || 0} SKUs</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Link to="/admin/inventory">
              <Button variant="secondary" size="sm" className="w-full text-xs">
                Inspect Low-Stock Variants (&lt; 10 units)
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold font-heading text-slate-900">Recent Customer Orders</h2>
            <p className="text-xs text-slate-500">Latest orders submitted to the storefront</p>
          </div>
          <Link to="/admin/orders">
            <Button variant="secondary" size="sm">
              All Orders &rarr;
            </Button>
          </Link>
        </div>

        {recentOrders && recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6">Order ID</th>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Payment Method</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-6 font-mono text-xs font-semibold text-slate-900">
                      {ord.orderNumber}
                    </td>
                    <td className="py-3 px-6">
                      <div className="text-slate-900 font-medium">{ord.user?.name || "Customer"}</div>
                      <div className="text-xs text-slate-400">{ord.user?.email || "N/A"}</div>
                    </td>
                    <td className="py-3 px-6 text-xs text-slate-500">
                      {formatDate(ord.createdAt)}
                    </td>
                    <td className="py-3 px-6 text-xs">
                      <span className="font-semibold text-slate-700">{ord.paymentMethod}</span>
                    </td>
                    <td className="py-3 px-6 font-semibold text-slate-900">
                      {formatCurrency(ord.totalPaise)}
                    </td>
                    <td className="py-3 px-6">
                      {getOrderStatusBadge(ord.orderStatus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-sm">
            No customer orders placed yet.
          </div>
        )}
      </Card>
    </div>
  );
}
