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
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "rzp_test_mockKeyId12345",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "mockKeySecret1234567890",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "mockWebhookSecret1234567890",
  // AWS Cloud Integration Settings
  AWS_REGION: process.env.AWS_REGION || "ap-south-1",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || "aurora-media-assets",
  AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL || "noreply@aurora-store.example.com"
});

module.exports = env;
