const { Router } = require("express");
const healthRoutes = require("../modules/health/health.routes");

const apiRouter = Router();

// Mount Health Check endpoint: /api/v1/health
apiRouter.use("/health", healthRoutes);

// Future module routes will be mounted cleanly here:
// apiRouter.use("/auth", authRoutes);
// apiRouter.use("/products", productRoutes);
// apiRouter.use("/cart", cartRoutes);
// apiRouter.use("/orders", orderRoutes);

module.exports = apiRouter;
