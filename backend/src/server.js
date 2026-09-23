const app = require("./app");
const env = require("./config/env");
const { connectDB, disconnectDB } = require("./config/database");
const { setShuttingDown } = require("./modules/health/health.controller");

let server;

/**
 * Bootstrap HTTP Server and Database Connection
 */
const startServer = async () => {
  try {
    // 1. Establish MongoDB connection first
    await connectDB();

    // 2. Start HTTP server
    server = app.listen(env.PORT, () => {
      console.log(`[Server] E-Commerce Backend running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      console.log(`[Server] Health check available at: http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error(`[Server Fatal] Failed to bootstrap server: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Graceful Shutdown Handler
 */
const handleGracefulShutdown = async (signal) => {
  console.log(`\n[Process] Received ${signal}. Starting graceful shutdown...`);

  // Immediately signal reverse proxy / load balancer that node is no longer accepting traffic
  setShuttingDown(true);

  if (server) {
    server.close(async () => {
      console.log("[Server] HTTP server closed to new connections.");
      await disconnectDB();
      console.log("[Process] Graceful shutdown completed. Exiting process.");
      process.exit(0);
    });

    // Force exit if shutdown hangs beyond 10 seconds
    setTimeout(() => {
      console.error("[Process Error] Graceful shutdown timed out. Forcing termination.");
      process.exit(1);
    }, 10000);
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

// Process Signal Listeners
process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

// Unhandled Rejections and Exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL UNHANDLED REJECTION]", reason);
  handleGracefulShutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("[CRITICAL UNCAUGHT EXCEPTION]", error);
  handleGracefulShutdown("uncaughtException");
});

// Boot application
startServer();
