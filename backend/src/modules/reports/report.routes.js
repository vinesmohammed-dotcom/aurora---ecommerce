const { Router } = require("express");
const reportController = require("./report.controller");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const { salesReportQuerySchema } = require("./report.validator");

// Helper for validating query params using Zod
const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (err) {
    next(err);
  }
};

const reportRouter = Router();

// Enforce authentication and administrative role
reportRouter.use(requireAuth, requireRole("ADMIN"));

// Sales report endpoints
reportRouter.get("/sales", validateQuery(salesReportQuerySchema), reportController.getSalesReport);
reportRouter.get("/sales/export.csv", validateQuery(salesReportQuerySchema), reportController.exportSalesCsv);
reportRouter.get("/sales/csv", validateQuery(salesReportQuerySchema), reportController.exportSalesCsv);
reportRouter.get("/sales/export.pdf", validateQuery(salesReportQuerySchema), reportController.exportSalesPdf);
reportRouter.get("/sales/pdf", validateQuery(salesReportQuerySchema), reportController.exportSalesPdf);

// Dashboard overview endpoint
reportRouter.get("/dashboard", reportController.getDashboardStats);

module.exports = reportRouter;
