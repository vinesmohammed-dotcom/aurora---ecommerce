const { Router } = require("express");
const WalletController = require("./wallet.controller");
const validate = require("../../middlewares/validate.middleware");
const { requireAuth, requireRole } = require("../../middlewares/auth.middleware");
const {
  adminAdjustWalletSchema,
  walletPaginationSchema
} = require("./wallet.validator");

// Customer Wallet Router: /api/v1/wallet
const walletRouter = Router();
walletRouter.use(requireAuth);

walletRouter.get("/", WalletController.getMyWallet);
walletRouter.get(
  "/transactions",
  validate(walletPaginationSchema, "query"),
  WalletController.getMyTransactions
);

// Admin Wallet Router: /api/v1/admin/wallets
const adminWalletRouter = Router();
adminWalletRouter.use(requireAuth);
adminWalletRouter.use(requireRole("ADMIN"));

adminWalletRouter.get("/:userId", WalletController.getAdminUserWallet);
adminWalletRouter.post(
  "/:userId/credit",
  validate(adminAdjustWalletSchema),
  WalletController.adminCreditWallet
);
adminWalletRouter.post(
  "/:userId/debit",
  validate(adminAdjustWalletSchema),
  WalletController.adminDebitWallet
);

module.exports = {
  walletRouter,
  adminWalletRouter
};
