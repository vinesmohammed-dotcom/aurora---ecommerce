const Coupon = require("./coupon.model");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class CouponService {
  /**
   * Create a new promotional coupon (Admin)
   */
  static async createCoupon(couponData) {
    const existing = await Coupon.findOne({ code: couponData.code });
    if (existing) {
      throw new AppError(
        `Coupon with code '${couponData.code}' already exists.`,
        HTTP_CODES.CONFLICT,
        ERROR_CODES.CONFLICT
      );
    }

    const coupon = await Coupon.create(couponData);
    return coupon;
  }

  /**
   * List coupons with optional filtering (Admin)
   */
  static async getCoupons(filter = {}) {
    return Coupon.find(filter).sort({ createdAt: -1 });
  }

  /**
   * Get single coupon by ID
   */
  static async getCouponById(id) {
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      throw new AppError("Coupon not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return coupon;
  }

  /**
   * Update coupon (Admin)
   */
  static async updateCoupon(id, updateData) {
    const coupon = await Coupon.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    if (!coupon) {
      throw new AppError("Coupon not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return coupon;
  }

  /**
   * Delete coupon (Admin)
   */
  static async deleteCoupon(id) {
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      throw new AppError("Coupon not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return { message: "Coupon deleted successfully." };
  }

  /**
   * Authoritative Coupon Validation and Calculation Engine:
   * Validates active status, validity window, global usage limit, per-user redemption limit,
   * and minimum order value against the current cart subtotal.
   *
   * @param {Object} params
   * @param {string} params.code - Coupon code
   * @param {string} params.userId - Authenticated user ID
   * @param {number} params.cartSubtotal - Subtotal after catalog item pricing / offer discounts
   * @param {Date} [params.now] - Verification timestamp
   * @returns {Promise<{ coupon: Object, discountAmount: number, code: string, discountType: string }>}
   */
  static async validateCouponForCart({ code, userId, cartSubtotal, now = new Date() }) {
    const normalizedCode = (code || "").trim().toUpperCase();
    const coupon = await Coupon.findOne({ code: normalizedCode });

    if (!coupon) {
      throw new AppError(
        `Coupon code '${normalizedCode}' is invalid or does not exist.`,
        HTTP_CODES.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (!coupon.isActive) {
      throw new AppError(
        `Coupon '${normalizedCode}' is no longer active.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (now < coupon.startDate) {
      throw new AppError(
        `Coupon '${normalizedCode}' is not yet active. Valid from ${coupon.startDate.toDateString()}.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (now > coupon.expiryDate) {
      throw new AppError(
        `Coupon '${normalizedCode}' has expired.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check global usage limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError(
        `Coupon '${normalizedCode}' has reached its maximum global usage limit.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check per-user usage limit
    const userEntry = (coupon.userUsage || []).find(
      (u) => u.userId.toString() === userId.toString()
    );
    const userUsedCount = userEntry ? userEntry.count : 0;
    if (userUsedCount >= coupon.perUserLimit) {
      throw new AppError(
        `You have already redeemed coupon '${normalizedCode}' the maximum allowed (${coupon.perUserLimit}) time(s).`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check minimum order value threshold
    if (cartSubtotal < coupon.minOrderValue) {
      throw new AppError(
        `Cart subtotal (₹${cartSubtotal}) does not meet the minimum order value of ₹${coupon.minOrderValue} required for coupon '${normalizedCode}'.`,
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Calculate discount
    let rawDiscount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      rawDiscount = (cartSubtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount !== null && coupon.maxDiscount > 0) {
        rawDiscount = Math.min(rawDiscount, coupon.maxDiscount);
      }
    } else if (coupon.discountType === "FLAT") {
      rawDiscount = Math.min(coupon.discountValue, cartSubtotal);
    }

    const discountAmount = Math.round(rawDiscount * 100) / 100;

    return {
      coupon,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      minOrderValue: coupon.minOrderValue,
      maxDiscount: coupon.maxDiscount
    };
  }

  /**
   * Record coupon redemption atomically upon successful order creation
   *
   * @param {Object} params
   * @param {string} params.code
   * @param {string} params.userId
   * @param {import("mongoose").ClientSession} [params.session]
   */
  static async recordCouponUsage({ code, userId, session = null }) {
    const normalizedCode = code.trim().toUpperCase();
    const coupon = await Coupon.findOne({ code: normalizedCode }).session(session);
    if (!coupon) return;

    coupon.usedCount += 1;

    const userEntry = coupon.userUsage.find(
      (u) => u.userId.toString() === userId.toString()
    );
    if (userEntry) {
      userEntry.count += 1;
    } else {
      coupon.userUsage.push({ userId, count: 1 });
    }

    await coupon.save({ session });
  }
}

module.exports = CouponService;
