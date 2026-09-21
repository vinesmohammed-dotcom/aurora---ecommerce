const mongoose = require("mongoose");
const env = require("./env");

/**
 * Connect to MongoDB with retry and state logging
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // Fail fast if cluster unreachable
    });

    console.log(`[Database] MongoDB connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    // In production or development server boot, we do not pretend the DB is available
    if (!env.isTest) {
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Disconnect from MongoDB gracefully
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log("[Database] MongoDB connection closed gracefully.");
  } catch (error) {
    console.error(`[Database Error] Error during MongoDB disconnection: ${error.message}`);
  }
};

/**
 * Get current database connection state
 * 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
const getDBStatus = () => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  return states[mongoose.connection.readyState] || "unknown";
};

module.exports = {
  connectDB,
  disconnectDB,
  getDBStatus
};
