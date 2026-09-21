const OfferService = require("./offer.service");
const HTTP_CODES = require("../../constants/httpCodes");

class OfferController {
  static async createOffer(req, res, next) {
    try {
      const offer = await OfferService.createOffer(req.body);
      return res.status(HTTP_CODES.CREATED).json({
        success: true,
        message: "Offer created successfully",
        data: { offer }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getOffers(req, res, next) {
    try {
      const filter = {};
      if (req.query.targetType) {
        filter.targetType = req.query.targetType;
      }
      if (req.query.isActive !== undefined) {
        filter.isActive = req.query.isActive === "true";
      }

      const offers = await OfferService.getOffers(filter);
      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: { offers }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getOfferById(req, res, next) {
    try {
      const offer = await OfferService.getOfferById(req.params.id);
      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: { offer }
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateOffer(req, res, next) {
    try {
      const offer = await OfferService.updateOffer(req.params.id, req.body);
      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: "Offer updated successfully",
        data: { offer }
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteOffer(req, res, next) {
    try {
      const result = await OfferService.deleteOffer(req.params.id);
      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = OfferController;
