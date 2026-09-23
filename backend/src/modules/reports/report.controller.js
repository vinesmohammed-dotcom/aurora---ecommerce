const ReportService = require("./report.service");
const ApiResponse = require("../../utils/ApiResponse");
const HTTP_CODES = require("../../constants/httpCodes");
const asyncHandler = require("../../utils/asyncHandler");

/**
 * Admin: Get sales metrics and reports in JSON
 * GET /api/v1/admin/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
const getSalesReport = asyncHandler(async (req, res) => {
  const result = await ReportService.getSalesReport(req.query);
  new ApiResponse(HTTP_CODES.OK, result, "Sales report retrieved successfully.").send(res);
});

/**
 * Admin: Get dashboard operational counts and recent orders
 * GET /api/v1/admin/reports/dashboard
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const result = await ReportService.getDashboardOverview();
  new ApiResponse(HTTP_CODES.OK, result, "Dashboard metrics retrieved successfully.").send(res);
});

/**
 * Admin: Export sales report as RFC 4180 CSV
 * GET /api/v1/admin/reports/sales/export.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
const exportSalesCsv = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const csvContent = await ReportService.generateSalesCsv({ from, to });
  const filename = `sales-report-${from || "last30days"}-to-${to || "today"}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(HTTP_CODES.OK).send(csvContent);
});

/**
 * Admin: Export sales report as PDF
 * GET /api/v1/admin/reports/sales/export.pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
const exportSalesPdf = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filename = `sales-report-${from || "last30days"}-to-${to || "today"}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await ReportService.generateSalesPdfStream({ from, to, res });
});

module.exports = {
  getSalesReport,
  getDashboardStats,
  exportSalesCsv,
  exportSalesPdf
};
