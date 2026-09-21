const HTTP_CODES = require("../constants/httpCodes");

/**
 * Standardized JSON API Response Builder
 */
class ApiResponse {
  constructor(statusCode = HTTP_CODES.OK, data = {}, message = "Request successful", meta = {}) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }

  /**
   * Send the JSON response via Express response object
   * @param {import("express").Response} res
   */
  send(res) {
    const payload = {
      success: this.success,
      message: this.message,
      data: this.data
    };

    if (Object.keys(this.meta).length > 0) {
      payload.meta = this.meta;
    }

    return res.status(this.statusCode).json(payload);
  }
}

module.exports = ApiResponse;
