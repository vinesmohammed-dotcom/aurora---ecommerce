const { Router } = require("express");
const OfferController = require("./offer.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const {
  createOfferSchema,
  updateOfferSchema,
  offerIdParamSchema
} = require("./offer.validator");

const publicOfferRouter = Router();
publicOfferRouter.get("/", OfferController.getOffers);
publicOfferRouter.get("/:id", validate(offerIdParamSchema, "params"), OfferController.getOfferById);

const adminOfferRouter = Router();
adminOfferRouter.use(requireAuth, requireRole("ADMIN"));

adminOfferRouter.get("/", OfferController.getOffers);
adminOfferRouter.post("/", validate(createOfferSchema), OfferController.createOffer);
adminOfferRouter.get("/:id", validate(offerIdParamSchema, "params"), OfferController.getOfferById);
adminOfferRouter.put(
  "/:id",
  validate(offerIdParamSchema, "params"),
  validate(updateOfferSchema),
  OfferController.updateOffer
);
adminOfferRouter.delete("/:id", validate(offerIdParamSchema, "params"), OfferController.deleteOffer);

module.exports = {
  publicOfferRouter,
  adminOfferRouter
};
