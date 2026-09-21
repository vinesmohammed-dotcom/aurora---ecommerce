const path = require("path");
const dotenv = require("dotenv");

// Load .env from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

// Required variables validation in production
const requiredInProduction = ["MONGODB_URI", "SESSION_SECRET", "FRONTEND_URL"];

if (isProduction) {
  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[FATAL CONFIG ERROR] Missing required production environment variables: ${missing.join(", ")}`
    );
  }
}

const env = Object.freeze({
  NODE_ENV,
  isProduction,
  isTest,
  isDevelopment: NODE_ENV === "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_dev",
  SESSION_SECRET: process.env.SESSION_SECRET || "dev_session_secret_replace_in_production_min_32_chars!",
  OTP_SECRET: process.env.OTP_SECRET || process.env.SESSION_SECRET || "dev_otp_hmac_secret_key_minimum_32_characters_long!",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173"
});

module.exports = env;
