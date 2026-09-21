const CheckoutService = require("./checkout.service");
const HTTP_CODES = require("../../constants/httpCodes");

class CheckoutController {
  /**
   * Calculate live checkout summary with dynamic catalog pricing, offers, coupon, and shipping
   */
  static async getSummary(req, res, next) {
    try {
      const { addressId, couponCode } = req.body || {};
      const checkoutData = await CheckoutService.calculateCheckoutSummary({
        userId: req.user._id,
        addressId,
        couponCode
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: checkoutData
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Apply coupon to checkout and return recalculation
   */
  static async applyCoupon(req, res, next) {
    try {
      const { couponCode, addressId } = req.body;
      const checkoutData = await CheckoutService.calculateCheckoutSummary({
        userId: req.user._id,
        addressId,
        couponCode
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: `Coupon '${couponCode}' applied successfully.`,
        data: checkoutData
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CheckoutController;
