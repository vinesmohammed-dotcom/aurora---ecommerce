const { Router } = require("express");
const userController = require("./user.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const { updateProfileSchema, adminUserQuerySchema, blockUserSchema } = require("./user.validator");

// Helper for validating query params using Zod
const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (err) {
    next(err);
  }
};

const customerUserRouter = Router();

// Protected User Profile Endpoints
customerUserRouter.get("/me", requireAuth, userController.getMyProfile);
customerUserRouter.patch("/me", requireAuth, validate(updateProfileSchema), userController.updateMyProfile);

// Admin User Management Endpoints
const adminUserRouter = Router();
adminUserRouter.use(requireAuth, requireRole("ADMIN"));

adminUserRouter.get("/", validateQuery(adminUserQuerySchema), userController.getUsersAdmin);
adminUserRouter.get("/:id", userController.getUserByIdAdmin);
adminUserRouter.patch("/:id/block", validate(blockUserSchema), userController.toggleUserBlock);

module.exports = {
  customerUserRouter,
  adminUserRouter,
  userRoutes: customerUserRouter
};

