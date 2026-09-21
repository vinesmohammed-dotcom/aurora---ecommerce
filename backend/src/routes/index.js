const { Router } = require("express");
const healthRoutes = require("../modules/health/health.routes");
const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/user.routes");

const apiRouter = Router();

// Mount Health Check endpoint: /api/v1/health
apiRouter.use("/health", healthRoutes);

// Mount Authentication & User Endpoints
apiRouter.use("/auth", authRoutes);
apiRouter.use("/users", userRoutes);

module.exports = apiRouter;
