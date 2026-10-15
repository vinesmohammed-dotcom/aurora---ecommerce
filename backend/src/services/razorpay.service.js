const env = require("../config/env");
const AppError = require("../utils/AppError");
const HTTP_CODES = require("../constants/httpCodes");
const ERROR_CODES = require("../constants/errorCodes");

/**
 * Isolated Razorpay Gateway Service
 * Server-authoritative integration with official Razorpay REST APIs.
 */
class RazorpayService {
  static getBaseUrl() {
    return "https://api.razorpay.com/v1";
  }

  /**
   * Generates Basic Auth header from configured credentials
   * @returns {string} HTTP Basic authorization header
   */
  static getAuthHeader() {
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new AppError(
        "Razorpay credentials (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET) are missing or not configured.",
        HTTP_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    return `Basic ${token}`;
  }

  /**
   * Create an authoritative order on Razorpay Orders API
   * Endpoint: POST https://api.razorpay.com/v1/orders
   *
   * @param {Object} params
   * @param {number} params.amount - Order amount in paise (e.g. 59800 for ₹598.00)
   * @param {string} [params.currency="INR"] - ISO currency code
   * @param {string} [params.receipt] - Merchant receipt / order number (max 40 chars)
   * @param {Object} [params.notes] - Key-value metadata attached to order
   * @returns {Promise<Object>} Official Razorpay Order object with provider id (e.g. "order_EKwxwAgIt42sCw")
   */
  static async createOrder({ amount, currency = "INR", receipt, notes = {} }) {
    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new AppError(
        "Invalid order amount. Amount must be a positive integer in smallest currency unit (paise).",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const payload = {
      amount: Math.round(amount),
      currency: currency || "INR",
      receipt: receipt ? String(receipt).substring(0, 40) : undefined,
      notes: typeof notes === "object" && notes !== null ? notes : {}
    };

    const url = `${this.getBaseUrl()}/orders`;
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": this.getAuthHeader()
        },
        body: JSON.stringify(payload)
      });
    } catch (networkErr) {
      throw new AppError(
        `Failed to reach Razorpay gateway: ${networkErr.message}`,
        HTTP_CODES.BAD_GATEWAY,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const providerError =
        responseData?.error?.description ||
        responseData?.error?.message ||
        `Gateway returned HTTP ${response.status}`;
      throw new AppError(
        `Razorpay order creation rejected: ${providerError}`,
        response.status >= 500 ? HTTP_CODES.BAD_GATEWAY : HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    if (!responseData || !responseData.id || !responseData.id.startsWith("order_")) {
      throw new AppError(
        "Invalid response payload from Razorpay Orders API: missing valid provider order id.",
        HTTP_CODES.BAD_GATEWAY,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    return responseData;
  }

  /**
   * Fetch an order from Razorpay by its gateway order ID
   * Endpoint: GET https://api.razorpay.com/v1/orders/:orderId
   *
   * @param {string} orderId - Razorpay order ID (e.g. "order_EKwxwAgIt42sCw")
   * @returns {Promise<Object>} Official Razorpay Order entity
   */
  static async fetchOrder(orderId) {
    if (!orderId || !orderId.startsWith("order_")) {
      throw new AppError(
        "Invalid Razorpay order ID provided.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const url = `${this.getBaseUrl()}/orders/${encodeURIComponent(orderId)}`;
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": this.getAuthHeader()
        }
      });
    } catch (networkErr) {
      throw new AppError(
        `Failed to reach Razorpay gateway: ${networkErr.message}`,
        HTTP_CODES.BAD_GATEWAY,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const providerError =
        responseData?.error?.description ||
        responseData?.error?.message ||
        `Gateway returned HTTP ${response.status}`;
      throw new AppError(
        `Failed to fetch Razorpay order: ${providerError}`,
        HTTP_CODES.BAD_GATEWAY,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    return responseData;
  }
}

module.exports = RazorpayService;
