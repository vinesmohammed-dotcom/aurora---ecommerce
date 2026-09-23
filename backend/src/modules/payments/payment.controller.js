const PaymentService = require("./payment.service");
const HTTP_CODES = require("../../constants/httpCodes");

class PaymentController {
  /**
   * Customer: Initiate online payment & reserve stock
   */
  static async createPayment(req, res, next) {
    try {
      const { addressId, couponCode } = req.body;
      const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey;

      const result = await PaymentService.createOnlinePayment({
        userId: req.user._id,
        addressId,
        couponCode,
        idempotencyKey
      });

      return res.status(HTTP_CODES.CREATED).json({
        success: true,
        message: "Payment order created successfully.",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer: Verify client-side payment callback signature
   */
  static async verifyPayment(req, res, next) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      const result = await PaymentService.verifyPaymentSignature({
        userId: req.user._id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: result.isDuplicate
          ? "Payment already verified and confirmed."
          : "Payment verified successfully. Order confirmed!",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer: Retry payment for unpaid or failed order
   */
  static async retryPayment(req, res, next) {
    try {
      const { orderId } = req.body;

      const result = await PaymentService.retryPayment({
        userId: req.user._id,
        orderId
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: "New payment session initialized for retry.",
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Razorpay Webhook Receiver
   * Processes raw webhook payload with HMAC-SHA256 signature verification & deduplication
   */
  static async handleWebhook(req, res, next) {
    try {
      const signature = req.headers["x-razorpay-signature"];
      const eventId = req.headers["x-razorpay-event-id"] || req.body?.event_id;
      const rawBody = req.rawBody;

      const result = await PaymentService.processWebhook({
        rawBody,
        signature,
        eventId,
        eventData: req.body
      });

      return res.status(HTTP_CODES.OK).json({
        status: "ok",
        received: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer / Admin: Get payment by Order ID
   */
  static async getPaymentByOrderId(req, res, next) {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const payment = await PaymentService.getPaymentByOrderId(
        req.params.orderId,
        req.user._id,
        isAdmin
      );

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: { payment }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer / Admin: Get payment by Payment ID
   */
  static async getPaymentById(req, res, next) {
    try {
      const isAdmin = req.user.role === "ADMIN";
      const payment = await PaymentService.getPaymentById(
        req.params.id,
        req.user._id,
        isAdmin
      );

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: { payment }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PaymentController;
