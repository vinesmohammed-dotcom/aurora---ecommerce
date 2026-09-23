import React, { useState, useEffect } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import api from "../../services/api";

export default function AdminReportsPage() {
  const getDefaultDates = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    return {
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0]
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDates());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/admin/reports/sales?from=${dateRange.from}&to=${dateRange.to}`);
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.message || "Failed to load sales report");
      }
    } catch (err) {
      setError(err.message || "Network error fetching sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatCurrency = (paise) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);

  const handleDownloadCsv = async () => {
    try {
      setExportingCsv(true);
      // Fetch via axios with blob response type
      const response = await api.get(`/admin/reports/sales/csv?from=${dateRange.from}&to=${dateRange.to}`, {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `sales-report-${dateRange.from}-to-${dateRange.to}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export CSV: " + (err.message || "Unknown error"));
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setExportingPdf(true);
      const response = await api.get(`/admin/reports/sales/pdf?from=${dateRange.from}&to=${dateRange.to}`, {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `sales-report-${dateRange.from}-to-${dateRange.to}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export PDF: " + (err.message || "Unknown error"));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Financial & Sales Intelligence</h1>
          <p className="text-sm text-slate-500">
            Consolidated transaction reporting, revenue realization, daily run rates, and exportable financial ledgers.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={exportingCsv || loading}
            className="flex items-center space-x-1.5"
          >
            <span>📥</span>
            <span>{exportingCsv ? "Exporting CSV..." : "Export CSV"}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={exportingPdf || loading}
            className="flex items-center space-x-1.5 shadow-sm"
          >
            <span>📄</span>
            <span>{exportingPdf ? "Generating PDF..." : "Export PDF Report"}</span>
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <Card className="p-4 border border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchReport();
          }}
          className="flex flex-wrap items-end gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          <Button type="submit" variant="secondary" size="md" disabled={loading}>
            {loading ? "Refreshing..." : "Apply Range"}
          </Button>

          {/* Quick presets */}
          <div className="flex items-center space-x-2 text-xs text-slate-500 ml-auto">
            <span>Presets:</span>
            <button
              type="button"
              onClick={() => {
                const to = new Date().toISOString().split("T")[0];
                const from = new Date();
                from.setDate(new Date().getDate() - 7);
                setDateRange({ from: from.toISOString().split("T")[0], to });
              }}
              className="hover:text-emerald-600 underline"
            >
              Last 7 Days
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                const def = getDefaultDates();
                setDateRange(def);
              }}
              className="hover:text-emerald-600 underline"
            >
              Last 30 Days
            </button>
          </div>
        </form>
      </Card>

      {/* Financial Precision Notice */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 flex items-start space-x-3 text-xs text-emerald-800">
        <span className="text-base">💎</span>
        <div>
          <span className="font-bold">Minor-Unit Financial Integrity Guarantee:</span> All platform revenue, discounts, shipping fees, and refunds are calculated using strict integer paise (₹1 = 100 paise) within MongoDB aggregation pipelines to eliminate IEEE-754 binary floating-point drift. Monetary values are converted to INR strictly at this presentation layer.
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm">Aggregating transactional ledger data...</p>
        </div>
      ) : error ? (
        <Card className="p-6 text-center border-rose-200 bg-rose-50">
          <p className="text-rose-600 font-semibold mb-2">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchReport}>
            Retry
          </Button>
        </Card>
      ) : (
        <>
          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-5 border-l-4 border-l-emerald-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross Sales</p>
              <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
                {formatCurrency(report?.summary?.grossSalesPaise)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Confirmed & Delivered volume</p>
            </Card>

            <Card className="p-5 border-l-4 border-l-blue-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Sales</p>
              <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
                {formatCurrency(report?.summary?.netSalesPaise)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Gross minus settled refunds</p>
            </Card>

            <Card className="p-5 border-l-4 border-l-amber-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gateway Refunds</p>
              <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
                {formatCurrency(report?.summary?.refundsPaise)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Razorpay captured refunds</p>
            </Card>

            <Card className="p-5 border-l-4 border-l-purple-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Order Value (AOV)</p>
              <p className="text-2xl font-extrabold font-heading text-slate-900 mt-2">
                {formatCurrency(report?.summary?.aovPaise)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Across <span className="font-semibold text-slate-800">{report?.summary?.orderCount || 0}</span> orders
              </p>
            </Card>
          </div>

          {/* Secondary Financial Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="p-4 bg-slate-50/70 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Coupons & Discounts</p>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  {formatCurrency(report?.summary?.discountsPaise)}
                </p>
              </div>
              <span className="text-2xl">🎟️</span>
            </Card>

            <Card className="p-4 bg-slate-50/70 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shipping Revenue Realized</p>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  {formatCurrency(report?.summary?.shippingPaise)}
                </p>
              </div>
              <span className="text-2xl">🚚</span>
            </Card>
          </div>

          {/* Daily Breakdown Table */}
          <Card className="overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold font-heading text-slate-900">Daily Sales Breakdown</h2>
                <p className="text-xs text-slate-500">Temporal sales trajectory within selected interval</p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {report?.dailySales?.length || 0} days active
              </span>
            </div>

            {report?.dailySales && report.dailySales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-6">Calendar Date</th>
                      <th className="py-3 px-6">Orders</th>
                      <th className="py-3 px-6">Gross Sales</th>
                      <th className="py-3 px-6">Discounts</th>
                      <th className="py-3 px-6">Net Realized</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.dailySales.map((day) => (
                      <tr key={day.date} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-6 font-mono text-xs font-semibold text-slate-900">
                          {day.date}
                        </td>
                        <td className="py-3 px-6 font-medium text-slate-800">
                          {day.orders}
                        </td>
                        <td className="py-3 px-6 font-semibold text-emerald-600">
                          {formatCurrency(day.grossPaise)}
                        </td>
                        <td className="py-3 px-6 text-slate-500">
                          {formatCurrency(day.discountsPaise)}
                        </td>
                        <td className="py-3 px-6 font-bold text-slate-900">
                          {formatCurrency(day.netPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No orders recorded in the chosen date range.
              </div>
            )}
          </Card>

          {/* Top Selling Products */}
          <Card className="overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-bold font-heading text-slate-900">Top-Selling Products by Revenue</h2>
              <p className="text-xs text-slate-500">Ranked by aggregate eligible merchandise turnover</p>
            </div>

            {report?.topProducts && report.topProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-6">Product Title</th>
                      <th className="py-3 px-6">Units Sold</th>
                      <th className="py-3 px-6">Gross Turnover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.topProducts.map((prod, idx) => (
                      <tr key={prod.productId || idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-6 font-medium text-slate-900 flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span>{prod.title}</span>
                        </td>
                        <td className="py-3 px-6 font-semibold text-slate-800">
                          {prod.unitsSold} units
                        </td>
                        <td className="py-3 px-6 font-bold text-emerald-600">
                          {formatCurrency(prod.revenuePaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No product sales recorded in the chosen date range.
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
