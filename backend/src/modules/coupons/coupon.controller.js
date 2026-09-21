const CouponService = require("./coupon.service");
const CartService = require("../cart/cart.service");
const HTTP_CODES = require("../../constants/httpCodes");

class CouponController {
  static async createCoupon(req, res, next) {
    try {
      const coupon = await CouponService.createCoupon(req.body);
      return res.status(HTTP_CODES.CREATED).json({
        success: true,
        message: "Coupon created successfully",
        data: { coupon }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCoupons(req, res, next) {
    try {
      const filter = {};
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === "true";
      }
      const coupons = await CouponService.getCoupons(filter);
      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: { coupons }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCouponById(req, res, next) {
    try {
      const coupon = await CouponService.getCouponById(req.params.id);
      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: { coupon }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCoupon(req, res, next) {
    try {
      const coupon = await CouponService.updateCoupon(req.params.id, req.body);
      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: "Coupon updated successfully",
        data: { coupon }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCoupon(req, res, next) {
    try {
      const result = await CouponService.deleteCoupon(req.params.id);
      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Validate coupon against current user's cart
   */
  static async validateCoupon(req, res, next) {
    try {
      const { code } = req.body;
      const cart = await CartService.getCart(req.user._id);

      const couponResult = await CouponService.validateCouponForCart({
        code,
        userId: req.user._id,
        cartSubtotal: cart.subtotal
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: `Coupon '${couponResult.code}' applied successfully.`,
        data: {
          code: couponResult.code,
          discountType: couponResult.discountType,
          discountValue: couponResult.discountValue,
          discountAmount: couponResult.discountAmount,
          cartSubtotal: cart.subtotal,
          newTotal: Math.max(0, cart.subtotal - couponResult.discountAmount)
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CouponController;
