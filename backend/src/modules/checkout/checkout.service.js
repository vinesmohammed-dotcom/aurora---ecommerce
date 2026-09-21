const Cart = require("../cart/cart.model");
const Product = require("../products/product.model");
const Address = require("../addresses/address.model");
const OfferService = require("../offers/offer.service");
const CouponService = require("../coupons/coupon.service");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

const FREE_SHIPPING_THRESHOLD = 1000; // Free shipping on orders >= ₹1,000
const STANDARD_SHIPPING_FEE = 99; // ₹99 shipping for orders < ₹1,000

class CheckoutService {
  /**
   * Helper to perform currency arithmetic in integer minor units (paise)
   * to eliminate IEEE-754 floating point precision errors.
   */
  static toPaise(rupees) {
    return Math.round(rupees * 100);
  }

  static toRupees(paise) {
    return Math.round(paise) / 100;
  }

  /**
   * Authoritative calculation engine for checkout summary.
   * NEVER trusts client prices or discounts. Validates live catalog, offers, coupons, and shipping.
   *
   * @param {Object} params
   * @param {string} params.userId - Authenticated user ID
   * @param {string} [params.addressId] - Selected shipping address
   * @param {string} [params.couponCode] - Applied coupon code
   * @param {Date} [params.now] - Evaluation timestamp
   */
  static async calculateCheckoutSummary({ userId, addressId = null, couponCode = null, now = new Date() }) {
    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError(
        "Cannot initiate checkout with an empty cart.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate optional address ownership
    let shippingAddress = null;
    if (addressId) {
      shippingAddress = await Address.findOne({ _id: addressId, userId });
      if (!shippingAddress) {
        throw new AppError(
          "Selected delivery address does not exist or access is denied.",
          HTTP_CODES.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }
    } else {
      // Auto-select user's default address if available
      shippingAddress = await Address.findOne({ userId, isDefault: true });
    }

    const evaluatedItems = [];
    let grossSubtotalPaise = 0;
    let offerDiscountTotalPaise = 0;

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        throw new AppError(
          `Product '${product ? product.name : item.productId}' is inactive or no longer available. Please update your cart.`,
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const variant = product.variants.id(item.variantId);
      if (!variant || !variant.isActive) {
        throw new AppError(
          `Selected variant for '${product.name}' is no longer available. Please update your cart.`,
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      if (variant.stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for '${product.name}'. Available: ${variant.stock}, requested: ${item.quantity}.`,
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Base unit price in paise
      const unitPricePaise = this.toPaise(variant.price);
      const itemGrossPaise = unitPricePaise * item.quantity;
      grossSubtotalPaise += itemGrossPaise;

      // Check promotional offers (Product vs Category, larger wins)
      const bestOffer = await OfferService.resolveBestOffer({
        productId: product._id,
        categoryId: product.category,
        now
      });

      let unitOfferDiscountPaise = 0;
      let appliedOffer = null;

      if (bestOffer && bestOffer.discountPercentage > 0) {
        unitOfferDiscountPaise = Math.round((unitPricePaise * bestOffer.discountPercentage) / 100);
        appliedOffer = {
          _id: bestOffer.offer._id,
          name: bestOffer.offer.name,
          targetType: bestOffer.offer.targetType,
          discountPercentage: bestOffer.discountPercentage
        };
      }

      const totalItemOfferDiscountPaise = unitOfferDiscountPaise * item.quantity;
      offerDiscountTotalPaise += totalItemOfferDiscountPaise;

      const discountedUnitPricePaise = unitPricePaise - unitOfferDiscountPaise;
      const itemNetTotalPaise = discountedUnitPricePaise * item.quantity;

      evaluatedItems.push({
        productId: product._id,
        variantId: variant._id,
        name: product.name,
        slug: product.slug,
        sku: variant.sku,
        attributes: variant.attributes instanceof Map ? Object.fromEntries(variant.attributes) : variant.attributes,
        image: (variant.images && variant.images[0]) || (product.images && product.images[0]) || "",
        unitPrice: this.toRupees(unitPricePaise),
        quantity: item.quantity,
        offer: appliedOffer,
        discountedUnitPrice: this.toRupees(discountedUnitPricePaise),
        itemTotal: this.toRupees(itemNetTotalPaise),
        availableStock: variant.stock
      });
    }

    const netSubtotalPaise = grossSubtotalPaise - offerDiscountTotalPaise;
    const netSubtotalRupees = this.toRupees(netSubtotalPaise);

    // Evaluate coupon code if provided
    let appliedCoupon = null;
    let couponDiscountPaise = 0;

    if (couponCode) {
      const couponResult = await CouponService.validateCouponForCart({
        code: couponCode,
        userId,
        cartSubtotal: netSubtotalRupees,
        now
      });

      couponDiscountPaise = this.toPaise(couponResult.discountAmount);
      appliedCoupon = {
        code: couponResult.code,
        discountType: couponResult.discountType,
        discountValue: couponResult.discountValue,
        discountAmount: couponResult.discountAmount,
        minOrderValue: couponResult.minOrderValue,
        maxDiscount: couponResult.maxDiscount
      };
    }

    const orderValueAfterDiscountsPaise = Math.max(0, netSubtotalPaise - couponDiscountPaise);
    const orderValueAfterDiscountsRupees = this.toRupees(orderValueAfterDiscountsPaise);

    // Authoritative Shipping Fee Calculation
    const shippingFeeRupees =
      orderValueAfterDiscountsRupees >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
    const shippingFeePaise = this.toPaise(shippingFeeRupees);

    const grandTotalPaise = orderValueAfterDiscountsPaise + shippingFeePaise;
    const grandTotalRupees = this.toRupees(grandTotalPaise);

    return {
      items: evaluatedItems,
      shippingAddress,
      appliedCoupon,
      summary: {
        grossSubtotal: this.toRupees(grossSubtotalPaise),
        offerDiscountTotal: this.toRupees(offerDiscountTotalPaise),
        netSubtotal: netSubtotalRupees,
        couponDiscount: this.toRupees(couponDiscountPaise),
        orderValueAfterDiscounts: orderValueAfterDiscountsRupees,
        shippingFee: shippingFeeRupees,
        grandTotal: grandTotalRupees,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        qualifiesForFreeShipping: orderValueAfterDiscountsRupees >= FREE_SHIPPING_THRESHOLD
      }
    };
  }
}

module.exports = CheckoutService;
