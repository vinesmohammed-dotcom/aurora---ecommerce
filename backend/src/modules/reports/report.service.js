const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const Order = require("../orders/order.model");
const Refund = require("../refunds/refund.model");
const User = require("../users/user.model");
const Product = require("../products/product.model");

class ReportService {
  /**
   * Helper: Parse date strings into UTC midnight boundaries
   */
  static parseDateRange(from, to) {
    let startDate;
    let endDate;

    if (from) {
      startDate = new Date(`${from}T00:00:00.000Z`);
    } else {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 30);
      d.setUTCHours(0, 0, 0, 0);
      startDate = d;
    }

    if (to) {
      endDate = new Date(`${to}T23:59:59.999Z`);
    } else {
      const d = new Date();
      d.setUTCHours(23, 59, 59, 999);
      endDate = d;
    }

    return { startDate, endDate };
  }

  /**
   * Helper: Match condition for successful, fulfilled or confirmed sales
   * Excludes unpaid PENDING orders, FAILED payments, and unpaid CANCELLED orders.
   */
  static getEligibleOrderCondition(startDate, endDate) {
    return {
      createdAt: { $gte: startDate, $lte: endDate },
      $or: [
        {
          paymentMethod: "ONLINE_RAZORPAY",
          paymentStatus: { $in: ["COMPLETED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"] }
        },
        {
          paymentMethod: "COD",
          orderStatus: {
            $in: [
              "CONFIRMED",
              "PROCESSING",
              "SHIPPED",
              "DELIVERED",
              "RETURN_REQUESTED",
              "RETURN_APPROVED",
              "RETURN_RECEIVED",
              "RETURN_INSPECTED",
              "RETURNED"
            ]
          }
        }
      ]
    };
  }

  /**
   * Get aggregated sales metrics, daily breakdown, and top-selling products
   */
  static async getSalesReport({ from, to, limit = 10 } = {}) {
    const { startDate, endDate } = this.parseDateRange(from, to);
    const orderMatch = this.getEligibleOrderCondition(startDate, endDate);

    // 1. Financial Totals from Orders
    const orderTotalsPromise = Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          grossSalesRupees: { $sum: "$priceSummary.grandTotal" },
          discountsRupees: {
            $sum: {
              $add: [
                { $ifNull: ["$priceSummary.offerDiscountTotal", 0] },
                { $ifNull: ["$priceSummary.couponDiscount", 0] }
              ]
            }
          },
          shippingRupees: { $sum: { $ifNull: ["$priceSummary.shippingFee", 0] } }
        }
      }
    ]);

    // 2. Refunds Totals (processed refunds in date range, stored in integer paise)
    const refundsPromise = Refund.aggregate([
      {
        $match: {
          status: "PROCESSED",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          refundsPaise: { $sum: "$amount" },
          refundCount: { $sum: 1 }
        }
      }
    ]);

    // 3. Daily Breakdown for Orders
    const dailyOrdersPromise = Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          orderCount: { $sum: 1 },
          grossSalesRupees: { $sum: "$priceSummary.grandTotal" },
          discountsRupees: {
            $sum: {
              $add: [
                { $ifNull: ["$priceSummary.offerDiscountTotal", 0] },
                { $ifNull: ["$priceSummary.couponDiscount", 0] }
              ]
            }
          },
          shippingRupees: { $sum: { $ifNull: ["$priceSummary.shippingFee", 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 4. Daily Breakdown for Refunds
    const dailyRefundsPromise = Refund.aggregate([
      {
        $match: {
          status: "PROCESSED",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
          refundsPaise: { $sum: "$amount" }
        }
      }
    ]);

    // 5. Top-Selling Products
    const topProductsPromise = Order.aggregate([
      { $match: orderMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          sku: { $first: "$items.sku" },
          unitsSold: { $sum: "$items.quantity" },
          totalRevenueRupees: { $sum: "$items.itemTotal" }
        }
      },
      { $sort: { unitsSold: -1, totalRevenueRupees: -1 } },
      { $limit: Number(limit) }
    ]);

    const [orderTotalsRes, refundsRes, dailyOrders, dailyRefunds, topProducts] = await Promise.all([
      orderTotalsPromise,
      refundsPromise,
      dailyOrdersPromise,
      dailyRefundsPromise,
      topProductsPromise
    ]);

    const orderTotals = orderTotalsRes[0] || {
      orderCount: 0,
      grossSalesRupees: 0,
      discountsRupees: 0,
      shippingRupees: 0
    };

    const refundsTotal = refundsRes[0] || {
      refundsPaise: 0,
      refundCount: 0
    };

    // Minor units (Paise)
    const grossSalesPaise = Math.round(orderTotals.grossSalesRupees * 100);
    const discountsPaise = Math.round(orderTotals.discountsRupees * 100);
    const shippingPaise = Math.round(orderTotals.shippingRupees * 100);
    const refundsPaise = Math.round(refundsTotal.refundsPaise);
    const netSalesPaise = grossSalesPaise - refundsPaise;
    const orderCount = orderTotals.orderCount;
    const aovPaise = orderCount > 0 ? Math.round(grossSalesPaise / orderCount) : 0;

    // Merge Daily Breakdown by Date Map
    const dateMap = new Map();
    for (const d of dailyOrders) {
      dateMap.set(d._id, {
        date: d._id,
        orderCount: d.orderCount,
        grossSalesPaise: Math.round(d.grossSalesRupees * 100),
        discountsPaise: Math.round(d.discountsRupees * 100),
        shippingPaise: Math.round(d.shippingRupees * 100),
        refundsPaise: 0,
        netSalesPaise: Math.round(d.grossSalesRupees * 100)
      });
    }

    for (const r of dailyRefunds) {
      const existing = dateMap.get(r._id) || {
        date: r._id,
        orderCount: 0,
        grossSalesPaise: 0,
        discountsPaise: 0,
        shippingPaise: 0,
        refundsPaise: 0,
        netSalesPaise: 0
      };
      existing.refundsPaise = Math.round(r.refundsPaise);
      existing.netSalesPaise = existing.grossSalesPaise - existing.refundsPaise;
      dateMap.set(r._id, existing);
    }

    const dailyBreakdown = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Convert top products revenue to paise
    const formattedTopProducts = topProducts.map((p) => ({
      productId: p._id,
      name: p.name,
      sku: p.sku,
      unitsSold: p.unitsSold,
      revenuePaise: Math.round(p.totalRevenueRupees * 100),
      revenueRupees: Number(p.totalRevenueRupees.toFixed(2))
    }));

    return {
      dateRange: {
        from: startDate.toISOString().split("T")[0],
        to: endDate.toISOString().split("T")[0]
      },
      summary: {
        orderCount,
        grossSalesPaise,
        grossSalesRupees: Number((grossSalesPaise / 100).toFixed(2)),
        discountsPaise,
        discountsRupees: Number((discountsPaise / 100).toFixed(2)),
        shippingPaise,
        shippingRupees: Number((shippingPaise / 100).toFixed(2)),
        refundsPaise,
        refundsRupees: Number((refundsPaise / 100).toFixed(2)),
        netSalesPaise,
        netSalesRupees: Number((netSalesPaise / 100).toFixed(2)),
        aovPaise,
        aovRupees: Number((aovPaise / 100).toFixed(2))
      },
      dailyBreakdown: dailyBreakdown.map((row) => ({
        ...row,
        grossSalesRupees: Number((row.grossSalesPaise / 100).toFixed(2)),
        discountsRupees: Number((row.discountsPaise / 100).toFixed(2)),
        shippingRupees: Number((row.shippingPaise / 100).toFixed(2)),
        refundsRupees: Number((row.refundsPaise / 100).toFixed(2)),
        netSalesRupees: Number((row.netSalesPaise / 100).toFixed(2))
      })),
      topProducts: formattedTopProducts
    };
  }

  /**
   * Admin Dashboard Operational Overview (Users, Products, Orders, Financials)
   */
  static async getDashboardOverview() {
    const [
      totalUsers,
      verifiedUsers,
      totalProducts,
      activeProducts,
      lowStockProducts,
      ordersByStatus,
      recentOrders,
      totalSalesAgg,
      totalRefundsAgg
    ] = await Promise.all([
      User.countDocuments({ role: "USER" }),
      User.countDocuments({ role: "USER", isVerified: true }),
      Product.countDocuments({}),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ "variants.stock": { $lt: 10 } }),
      Order.aggregate([
        {
          $group: {
            _id: "$orderStatus",
            count: { $sum: 1 }
          }
        }
      ]),
      Order.find({})
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      Order.aggregate([
        {
          $match: {
            $or: [
              {
                paymentMethod: "ONLINE_RAZORPAY",
                paymentStatus: { $in: ["COMPLETED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"] }
              },
              {
                paymentMethod: "COD",
                orderStatus: {
                  $in: [
                    "CONFIRMED",
                    "PROCESSING",
                    "SHIPPED",
                    "DELIVERED",
                    "RETURN_REQUESTED",
                    "RETURN_APPROVED",
                    "RETURN_RECEIVED",
                    "RETURN_INSPECTED",
                    "RETURNED"
                  ]
                }
              }
            ]
          }
        },
        {
          $group: {
            _id: null,
            totalGrossRupees: { $sum: "$priceSummary.grandTotal" }
          }
        }
      ]),
      Refund.aggregate([
        { $match: { status: "PROCESSED" } },
        { $group: { _id: null, totalRefundsPaise: { $sum: "$amount" } } }
      ])
    ]);


    const statusCounts = {
      PENDING: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      RETURN_REQUESTED: 0,
      RETURN_APPROVED: 0,
      RETURN_RECEIVED: 0,
      RETURN_INSPECTED: 0,
      RETURNED: 0
    };

    let totalOrders = 0;
    for (const item of ordersByStatus) {
      if (statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
      totalOrders += item.count;
    }

    const grossSalesPaise = Math.round((totalSalesAgg[0]?.totalGrossRupees || 0) * 100);
    const refundsPaise = Math.round(totalRefundsAgg[0]?.totalRefundsPaise || 0);
    const netSalesPaise = grossSalesPaise - refundsPaise;

    return {
      users: {
        total: totalUsers,
        verified: verifiedUsers
      },
      products: {
        total: totalProducts,
        active: activeProducts,
        lowStock: lowStockProducts
      },
      orders: {
        total: totalOrders,
        pending: statusCounts.PENDING,
        confirmed: statusCounts.CONFIRMED,
        delivered: statusCounts.DELIVERED,
        cancelled: statusCounts.CANCELLED,
        returns:
          statusCounts.RETURN_REQUESTED +
          statusCounts.RETURN_APPROVED +
          statusCounts.RETURN_RECEIVED +
          statusCounts.RETURN_INSPECTED +
          statusCounts.RETURNED,
        byStatus: statusCounts
      },
      financials: {
        grossSalesPaise,
        grossSalesRupees: Number((grossSalesPaise / 100).toFixed(2)),
        refundsPaise,
        refundsRupees: Number((refundsPaise / 100).toFixed(2)),
        netSalesPaise,
        netSalesRupees: Number((netSalesPaise / 100).toFixed(2))
      },
      recentOrders: recentOrders.map((o) => ({
        id: o._id,
        orderNumber: o.orderNumber,
        customerName: o.userId ? o.userId.name : o.shippingAddress?.fullName || "Guest",
        customerEmail: o.userId ? o.userId.email : "",
        grandTotalRupees: o.priceSummary?.grandTotal || 0,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt
      }))
    };
  }

  /**
   * Generate RFC 4180 CSV Export String
   */
  static async generateSalesCsv({ from, to }) {
    const report = await this.getSalesReport({ from, to, limit: 100 });

    const escapeCsv = (val) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [];

    // Header Metadata
    lines.push(`PRIME STORE - SALES & OPERATIONS REPORT`);
    lines.push(`Date Range: ${report.dateRange.from} to ${report.dateRange.to}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");

    // Executive Summary
    lines.push("EXECUTIVE FINANCIAL SUMMARY");
    lines.push("Metric,Amount (INR)");
    lines.push(`Total Orders,${report.summary.orderCount}`);
    lines.push(`Gross Sales,${report.summary.grossSalesRupees}`);
    lines.push(`Discounts Given,${report.summary.discountsRupees}`);
    lines.push(`Shipping Fees Collected,${report.summary.shippingRupees}`);
    lines.push(`Refunds Processed,${report.summary.refundsRupees}`);
    lines.push(`Net Sales,${report.summary.netSalesRupees}`);
    lines.push(`Average Order Value (AOV),${report.summary.aovRupees}`);
    lines.push("");

    // Daily Table
    lines.push("DAILY SALES BREAKDOWN");
    lines.push("Date,Orders Count,Gross Sales (INR),Discounts (INR),Shipping (INR),Refunds (INR),Net Sales (INR)");

    for (const row of report.dailyBreakdown) {
      lines.push(
        [
          escapeCsv(row.date),
          row.orderCount,
          row.grossSalesRupees,
          row.discountsRupees,
          row.shippingRupees,
          row.refundsRupees,
          row.netSalesRupees
        ].join(",")
      );
    }

    lines.push("");

    // Top Selling Products
    lines.push("TOP SELLING PRODUCTS");
    lines.push("Product Name,SKU,Units Sold,Revenue (INR)");
    for (const p of report.topProducts) {
      lines.push([escapeCsv(p.name), escapeCsv(p.sku), p.unitsSold, p.revenueRupees].join(","));
    }

    return lines.join("\r\n");
  }

  /**
   * Generate PDF Stream using PDFKit
   */
  static async generateSalesPdfStream({ from, to, res }) {
    const report = await this.getSalesReport({ from, to, limit: 10 });

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    // Header Banner
    doc.rect(40, 40, 515, 60).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(18).text("PRIME STORE", 55, 52, { bold: true });
    doc.fontSize(11).fillColor("#94a3b8").text("Executive Sales & Financial Operations Report", 55, 75);

    // Report Metadata
    doc.fillColor("#334155").fontSize(9);
    doc.text(`Reporting Period: ${report.dateRange.from} to ${report.dateRange.to}`, 40, 115);
    doc.text(`Generated On: ${new Date().toUTCString()}`, 40, 128);
    doc.text(`Currency: INR (Conversion: 100 paise = 1 Rupee)`, 40, 141);

    // Section 1: Executive Summary
    doc.fillColor("#0f172a").fontSize(13).text("1. Executive Financial Summary", 40, 165, { underline: true });

    const summaryTableTop = 185;
    const metrics = [
      ["Total Successful Orders", String(report.summary.orderCount)],
      ["Gross Sales", `Rs. ${report.summary.grossSalesRupees.toLocaleString("en-IN")}`],
      ["Promotional Discounts", `Rs. ${report.summary.discountsRupees.toLocaleString("en-IN")}`],
      ["Shipping Fees Collected", `Rs. ${report.summary.shippingRupees.toLocaleString("en-IN")}`],
      ["Processed Refunds", `Rs. ${report.summary.refundsRupees.toLocaleString("en-IN")}`],
      ["Net Sales (Gross - Refunds)", `Rs. ${report.summary.netSalesRupees.toLocaleString("en-IN")}`],
      ["Average Order Value (AOV)", `Rs. ${report.summary.aovRupees.toLocaleString("en-IN")}`]
    ];

    let rowY = summaryTableTop;
    metrics.forEach(([label, val], idx) => {
      const bgColor = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
      doc.rect(40, rowY, 515, 18).fill(bgColor);
      doc.fillColor("#475569").fontSize(9).text(label, 50, rowY + 4);
      doc.fillColor("#0f172a").fontSize(9).text(val, 400, rowY + 4, { align: "right", width: 145 });
      rowY += 18;
    });

    // Section 2: Top Selling Products
    const topProdY = rowY + 20;
    doc.fillColor("#0f172a").fontSize(13).text("2. Top Performing Products", 40, topProdY, { underline: true });

    let prodY = topProdY + 20;
    // Table Header
    doc.rect(40, prodY, 515, 18).fill("#e2e8f0");
    doc.fillColor("#1e293b").fontSize(9).text("Product Name", 50, prodY + 4);
    doc.text("SKU", 280, prodY + 4);
    doc.text("Units Sold", 380, prodY + 4, { align: "right", width: 60 });
    doc.text("Revenue", 450, prodY + 4, { align: "right", width: 95 });
    prodY += 18;

    if (report.topProducts.length === 0) {
      doc.rect(40, prodY, 515, 18).fill("#ffffff");
      doc.fillColor("#94a3b8").fontSize(9).text("No product sales recorded in this period.", 50, prodY + 4);
      prodY += 18;
    } else {
      report.topProducts.forEach((p, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(40, prodY, 515, 18).fill(bg);
        doc.fillColor("#334155").fontSize(8).text(p.name.slice(0, 38), 50, prodY + 4);
        doc.text(p.sku, 280, prodY + 4);
        doc.text(String(p.unitsSold), 380, prodY + 4, { align: "right", width: 60 });
        doc.text(`Rs. ${p.revenueRupees.toLocaleString("en-IN")}`, 450, prodY + 4, { align: "right", width: 95 });
        prodY += 18;
      });
    }

    // Section 3: Daily Activity Sample (up to 7 days on first page)
    const dailySectionY = prodY + 20;
    if (dailySectionY < 720) {
      doc.fillColor("#0f172a").fontSize(13).text("3. Daily Activity Overview", 40, dailySectionY, { underline: true });
      let dayY = dailySectionY + 20;

      doc.rect(40, dayY, 515, 18).fill("#e2e8f0");
      doc.fillColor("#1e293b").fontSize(9).text("Date", 50, dayY + 4);
      doc.text("Orders", 150, dayY + 4, { align: "right", width: 45 });
      doc.text("Gross (INR)", 210, dayY + 4, { align: "right", width: 95 });
      doc.text("Refunds (INR)", 320, dayY + 4, { align: "right", width: 95 });
      doc.text("Net Sales (INR)", 430, dayY + 4, { align: "right", width: 115 });
      dayY += 18;

      const displayDays = report.dailyBreakdown.slice(-7);
      displayDays.forEach((d, idx) => {
        if (dayY < 780) {
          const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
          doc.rect(40, dayY, 515, 16).fill(bg);
          doc.fillColor("#334155").fontSize(8).text(d.date, 50, dayY + 3);
          doc.text(String(d.orderCount), 150, dayY + 3, { align: "right", width: 45 });
          doc.text(`Rs. ${d.grossSalesRupees.toLocaleString("en-IN")}`, 210, dayY + 3, { align: "right", width: 95 });
          doc.text(`Rs. ${d.refundsRupees.toLocaleString("en-IN")}`, 320, dayY + 3, { align: "right", width: 95 });
          doc.text(`Rs. ${d.netSalesRupees.toLocaleString("en-IN")}`, 430, dayY + 3, { align: "right", width: 115 });
          dayY += 16;
        }
      });
    }

    // Footer
    doc.fillColor("#94a3b8").fontSize(8).text(
      "CONFIDENTIAL & PROPRIETARY — PrimeStore E-Commerce Administrative Platform",
      40,
      800,
      { align: "center", width: 515 }
    );

    doc.end();
  }
}

module.exports = ReportService;
