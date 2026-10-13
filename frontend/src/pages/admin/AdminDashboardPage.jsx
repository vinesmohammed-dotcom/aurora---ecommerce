import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import api from "../../services/api";

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [salesReport, setSalesReport] = useState(null);
  const [chartRange, setChartRange] = useState("30d");
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboardAndCharts() {
      try {
        setLoading(true);
        setError(null);

        const to = new Date();
        const from = new Date();
        const days = chartRange === "7d" ? 7 : chartRange === "90d" ? 90 : 30;
        from.setDate(to.getDate() - days);
        const fromStr = from.toISOString().split("T")[0];
        const toStr = to.toISOString().split("T")[0];

        const [dashRes, salesRes] = await Promise.all([
          api.get("/admin/reports/dashboard"),
          api.get(`/admin/reports/sales?from=${fromStr}&to=${toStr}`)
        ]);

        if (dashRes.success && dashRes.data) {
          setData(dashRes.data);
        } else {
          setError(dashRes.message || "Failed to load dashboard metrics");
        }

        if (salesRes.success && salesRes.data) {
          setSalesReport(salesRes.data);
        }
      } catch (err) {
        setError(err.message || "Network error fetching dashboard metrics");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardAndCharts();
  }, [chartRange]);

  const formatCurrency = (paise) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);

  const formatRupees = (rupees) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(rupees || 0);

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

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm font-medium">Aggregating platform intelligence...</p>
      </div>
    );
  }

  if (error && !data) {
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
  const dailyBreakdown = salesReport?.dailyBreakdown || [];
  const topProducts = salesReport?.topProducts || [];

  // SVG Chart Calculations for Sales Trend
  const chartWidth = 660;
  const chartHeight = 180;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...dailyBreakdown.map((d) => Math.max(d.grossSalesRupees || 0, d.netSalesRupees || 0)),
    100
  );

  const points = dailyBreakdown.map((d, idx) => {
    const x =
      paddingLeft +
      (dailyBreakdown.length > 1
        ? (idx / (dailyBreakdown.length - 1)) * graphWidth
        : graphWidth / 2);
    const yGross = paddingTop + graphHeight - ((d.grossSalesRupees || 0) / maxVal) * graphHeight;
    const yNet = paddingTop + graphHeight - ((d.netSalesRupees || 0) / maxVal) * graphHeight;
    return { x, yGross, yNet, data: d };
  });

  const grossPath =
    points.length > 0
      ? `M ${points[0].x},${points[0].yGross} ` +
        points.slice(1).map((p) => `L ${p.x},${p.yGross}`).join(" ")
      : "";

  const grossAreaPath =
    points.length > 0
      ? `${grossPath} L ${points[points.length - 1].x},${paddingTop + graphHeight} L ${points[0].x},${
          paddingTop + graphHeight
        } Z`
      : "";

  const netPath =
    points.length > 0
      ? `M ${points[0].x},${points[0].yNet} ` +
        points.slice(1).map((p) => `L ${p.x},${p.yNet}`).join(" ")
      : "";

  // Order Status Donut Chart Calculations
  const statusCounts = [
    { label: "Delivered", count: orders?.delivered || 0, color: "#10B981" },
    { label: "Shipped", count: orders?.shipped || 0, color: "#6366F1" },
    { label: "Processing", count: orders?.processing || 0, color: "#F59E0B" },
    { label: "Confirmed", count: orders?.confirmed || 0, color: "#0284C7" },
    { label: "Cancelled", count: orders?.cancelled || 0, color: "#F43F5E" },
    { label: "Return Req", count: orders?.returnRequested || 0, color: "#A855F7" }
  ];
  const totalStatusOrders = statusCounts.reduce((acc, s) => acc + s.count, 0) || 1;
  const circumference = 2 * Math.PI * 45; // radius = 45

  let accumulatedOffset = 0;
  const donutSegments = statusCounts.map((s) => {
    const fraction = s.count / totalStatusOrders;
    const strokeDash = fraction * circumference;
    const offset = accumulatedOffset;
    accumulatedOffset += strokeDash;
    return {
      ...s,
      percentage: Math.round(fraction * 100),
      strokeDasharray: `${strokeDash} ${circumference - strokeDash}`,
      strokeDashoffset: -offset
    };
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Platform Command Center</h1>
          <p className="text-sm text-slate-500">
            Real-time financial performance, interactive metrics, and order fulfillment trajectory.
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

        <Card className="p-5 border-l-4 border-l-indigo-500 hover:shadow-md transition">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Sales Realized</p>
          <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
            {formatCurrency(financials?.netSalesPaise)}
          </p>
          <div className="mt-2 flex items-center text-xs text-slate-500 space-x-1">
            <span>Gross minus settled refunds</span>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-rose-500 hover:shadow-md transition">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Refunds Disbursed</p>
          <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
            {formatCurrency(financials?.refundsPaise)}
          </p>
          <div className="mt-2 flex items-center text-xs text-slate-500 space-x-1">
            <span>Settled ledger refunds</span>
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

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Revenue Trend Chart */}
        <Card className="p-6 lg:col-span-2 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">
                Revenue Trajectory & Sales Volume
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily financial inflow comparing Gross Sales vs Net Realized Revenue
              </p>
            </div>
            {/* Timeframe Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              {["7d", "30d", "90d"].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setChartRange(range)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    chartRange === range
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {range === "7d" ? "7 Days" : range === "90d" ? "90 Days" : "30 Days"}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Chart Container */}
          <div className="relative">
            {dailyBreakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-auto min-w-[500px]"
                >
                  <defs>
                    <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = paddingTop + graphHeight - pct * graphHeight;
                    return (
                      <g key={i}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={chartWidth - paddingRight}
                          y2={y}
                          stroke="#E2E8F0"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={paddingLeft - 8}
                          y={y + 3}
                          fontSize="9"
                          fill="#94A3B8"
                          textAnchor="end"
                          fontFamily="sans-serif"
                        >
                          ₹{(maxVal * pct).toFixed(0)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area fill */}
                  {grossAreaPath && <path d={grossAreaPath} fill="url(#grossGradient)" />}

                  {/* Gross Sales Line (Emerald) */}
                  {grossPath && (
                    <path
                      d={grossPath}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Net Sales Line (Indigo) */}
                  {netPath && (
                    <path
                      d={netPath}
                      fill="none"
                      stroke="#6366F1"
                      strokeWidth="2"
                      strokeDasharray="5 3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Data Points */}
                  {points.map((p, i) => (
                    <g key={i} className="cursor-pointer">
                      <circle
                        cx={p.x}
                        cy={p.yGross}
                        r={hoveredPoint?.data?.date === p.data.date ? 5 : 3}
                        fill="#10B981"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                        onMouseEnter={() => setHoveredPoint(p)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  ))}

                  {/* X-Axis Date Labels */}
                  {points
                    .filter((_, idx) => idx === 0 || idx === Math.floor(points.length / 2) || idx === points.length - 1)
                    .map((p, i) => (
                      <text
                        key={i}
                        x={p.x}
                        y={chartHeight - 8}
                        fontSize="10"
                        fill="#64748B"
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        {p.data.date}
                      </text>
                    ))}
                </svg>
              </div>
            ) : (
              <div className="flex h-44 items-center justify-center text-xs text-slate-400">
                No revenue records within this selected timeframe.
              </div>
            )}

            {/* Hover Tooltip Card */}
            {hoveredPoint && (
              <div
                className="absolute z-10 rounded-lg bg-slate-900 p-2.5 text-xs text-white shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                  top: `${(hoveredPoint.yGross / chartHeight) * 100 - 8}%`
                }}
              >
                <p className="font-semibold text-slate-300 border-b border-slate-700 pb-1 mb-1">
                  {hoveredPoint.data.date}
                </p>
                <div className="space-y-0.5">
                  <p className="text-emerald-400">Gross: {formatRupees(hoveredPoint.data.grossSalesRupees)}</p>
                  <p className="text-indigo-300">Net: {formatRupees(hoveredPoint.data.netSalesRupees)}</p>
                  <p className="text-slate-400">{hoveredPoint.data.orderCount} order(s)</p>
                </div>
              </div>
            )}
          </div>

          {/* Chart Legend */}
          <div className="mt-4 flex items-center justify-end gap-6 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Gross Sales (Area)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <span>Net Revenue (Dashed)</span>
            </div>
          </div>
        </Card>

        {/* Order Status Distribution Donut Chart */}
        <Card className="p-6 border border-slate-200 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold font-heading text-slate-900 mb-1">
              Fulfillment Pipeline Mix
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Real-time proportion of active lifecycle order statuses
            </p>

            <div className="flex items-center justify-center my-3">
              <div className="relative h-44 w-44">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  {donutSegments.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx="60"
                      cy="60"
                      r="45"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="16"
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      className="transition-all duration-500"
                    />
                  ))}
                </svg>
                {/* Center Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-extrabold text-slate-900">{orders?.total || 0}</span>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                    Orders
                  </span>
                </div>
              </div>
            </div>

            {/* Status Breakdown Legend */}
            <div className="space-y-1.5 pt-2">
              {donutSegments.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span>{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-semibold text-slate-900">{s.count}</span>
                    <span className="text-slate-400 text-[11px]">({s.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Operational Grids: Top-Selling Leaderboard & Inventory Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top-Selling Products Leaderboard */}
        <Card className="p-6 lg:col-span-2 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold font-heading text-slate-900">
                Top-Selling Products Leaderboard
              </h2>
              <p className="text-xs text-slate-500">
                Authorized product performance ranked by units sold in the selected period
              </p>
            </div>
            <Link to="/admin/reports" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
              Detailed Analytics &rarr;
            </Link>
          </div>

          {topProducts && topProducts.length > 0 ? (
            <div className="space-y-4">
              {topProducts.slice(0, 5).map((prod, idx) => {
                const maxUnits = topProducts[0]?.unitsSold || 1;
                const pct = Math.min(100, Math.round((prod.unitsSold / maxUnits) * 100));
                return (
                  <div key={prod.productId || idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900 line-clamp-1">{prod.name}</span>
                        {prod.sku && <span className="text-[11px] font-mono text-slate-400">({prod.sku})</span>}
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="font-bold text-slate-800">{prod.unitsSold} sold</span>
                        <span className="text-emerald-600 font-semibold">{formatRupees(prod.revenueRupees)}</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No top-selling product data available for this timeframe.
            </div>
          )}
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
