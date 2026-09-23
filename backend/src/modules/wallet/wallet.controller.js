const WalletService = require("./wallet.service");
const HTTP_CODES = require("../../constants/httpCodes");

class WalletController {
  /**
   * Customer: Get authenticated user's wallet and current balance
   */
  static async getMyWallet(req, res, next) {
    try {
      const wallet = await WalletService.getWallet(req.user._id);

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: { wallet }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Customer: Get paginated wallet transaction history
   */
  static async getMyTransactions(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await WalletService.getTransactions(req.user._id, { page, limit });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: View specific user's wallet profile and balance
   */
  static async getAdminUserWallet(req, res, next) {
    try {
      const { userId } = req.params;
      const result = await WalletService.getAdminUserWallet(userId);

      return res.status(HTTP_CODES.OK).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Credit user's wallet with audit tracking
   */
  static async adminCreditWallet(req, res, next) {
    try {
      const { userId } = req.params;
      const { amount, reason, idempotencyKey } = req.body;

      const result = await WalletService.adminCreditWallet({
        adminId: req.user._id,
        targetUserId: userId,
        amount,
        reason,
        referenceId: idempotencyKey || null
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: `Successfully credited ₹${amount} to user's wallet.`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Debit user's wallet with audit tracking
   */
  static async adminDebitWallet(req, res, next) {
    try {
      const { userId } = req.params;
      const { amount, reason, idempotencyKey } = req.body;

      const result = await WalletService.adminDebitWallet({
        adminId: req.user._id,
        targetUserId: userId,
        amount,
        reason,
        referenceId: idempotencyKey || null
      });

      return res.status(HTTP_CODES.OK).json({
        success: true,
        message: `Successfully debited ₹${amount} from user's wallet.`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WalletController;
