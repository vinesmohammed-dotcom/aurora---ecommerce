const mongoose = require("mongoose");
const Wallet = require("./wallet.model");
const WalletTransaction = require("./walletTransaction.model");
const User = require("../users/user.model");
const { runInTransaction } = require("../../utils/transaction");
const AuditLogger = require("../../utils/auditLogger");
const AppError = require("../../utils/AppError");
const HTTP_CODES = require("../../constants/httpCodes");
const ERROR_CODES = require("../../constants/errorCodes");

class WalletService {
  /**
   * Safely locate or initialize a Customer Wallet
   * Handled with concurrency protection against duplicate key races.
   */
  static async getOrCreateWallet(userId, session = null) {
    let wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      try {
        const [newWallet] = await Wallet.create(
          [
            {
              userId,
              balance: 0,
              currency: "INR",
              isActive: true
            }
          ],
          session ? { session } : {}
        );
        wallet = newWallet;
      } catch (err) {
        if (err.code === 11000) {
          wallet = await Wallet.findOne({ userId }).session(session);
        } else {
          throw err;
        }
      }
    }
    return wallet;
  }

  /**
   * Customer: Get wallet profile with authoritative balance
   */
  static async getWallet(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return wallet;
  }

  /**
   * Customer: Get paginated wallet transaction history
   */
  static async getTransactions(userId, { page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      WalletTransaction.countDocuments({ userId })
    ]);

    return {
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    };
  }

  /**
   * Atomic Wallet Credit with Ledger Insertion & Idempotency
   * Strictly coordinated within MongoDB multi-document transaction.
   */
  static async creditWallet({
    userId,
    amount,
    referenceType,
    referenceId = null,
    description = "",
    metadata = {},
    session: externalSession = null
  }) {
    const amountPaise = Math.round(amount);

    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      throw new AppError(
        "Credit amount in minor units (paise) must be a positive integer.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Idempotency check: if referenceId is provided, check if event has already been executed
    if (referenceId) {
      const existingTx = await WalletTransaction.findOne({
        referenceType,
        referenceId
      });
      if (existingTx) {
        const wallet = await Wallet.findOne({ userId });
        return { wallet, transaction: existingTx, isDuplicate: true };
      }
    }

    const executeOperation = async (session) => {
      // Re-verify idempotency within transaction session to prevent concurrent submission race
      if (referenceId) {
        const existingTx = await WalletTransaction.findOne({
          referenceType,
          referenceId
        }).session(session);
        if (existingTx) {
          const wallet = await Wallet.findOne({ userId }).session(session);
          return { wallet, transaction: existingTx, isDuplicate: true };
        }
      }

      const wallet = await this.getOrCreateWallet(userId, session);

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amountPaise;

      wallet.balance = balanceAfter;
      await wallet.save({ session });

      const [transaction] = await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId,
            type: "CREDIT",
            amount: amountPaise,
            balanceBefore,
            balanceAfter,
            referenceType,
            referenceId: referenceId || null,
            description: description || `Wallet credited with ₹${(amountPaise / 100).toFixed(2)}`,
            metadata
          }
        ],
        { session }
      );

      return { wallet, transaction, isDuplicate: false };
    };

    if (externalSession) {
      return await executeOperation(externalSession);
    }
    return await runInTransaction(executeOperation);
  }

  /**
   * Atomic Wallet Debit with Ledger Insertion, Balance Guard & Idempotency
   * Strictly enforces balance >= requested amount; rejects negative balance.
   */
  static async debitWallet({
    userId,
    amount,
    referenceType,
    referenceId = null,
    description = "",
    metadata = {},
    session: externalSession = null
  }) {
    const amountPaise = Math.round(amount);

    if (!amountPaise || amountPaise <= 0 || isNaN(amountPaise)) {
      throw new AppError(
        "Debit amount in minor units (paise) must be a positive integer.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Idempotency check
    if (referenceId) {
      const existingTx = await WalletTransaction.findOne({
        referenceType,
        referenceId
      });
      if (existingTx) {
        const wallet = await Wallet.findOne({ userId });
        return { wallet, transaction: existingTx, isDuplicate: true };
      }
    }

    const executeOperation = async (session) => {
      if (referenceId) {
        const existingTx = await WalletTransaction.findOne({
          referenceType,
          referenceId
        }).session(session);
        if (existingTx) {
          const wallet = await Wallet.findOne({ userId }).session(session);
          return { wallet, transaction: existingTx, isDuplicate: true };
        }
      }

      const wallet = await this.getOrCreateWallet(userId, session);

      if (wallet.balance < amountPaise) {
        throw new AppError(
          `Insufficient wallet balance. Available: ₹${(wallet.balance / 100).toFixed(2)}, Requested: ₹${(amountPaise / 100).toFixed(2)}`,
          HTTP_CODES.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore - amountPaise;

      wallet.balance = balanceAfter;
      await wallet.save({ session });

      const [transaction] = await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId,
            type: "DEBIT",
            amount: amountPaise,
            balanceBefore,
            balanceAfter,
            referenceType,
            referenceId: referenceId || null,
            description: description || `Wallet debited with ₹${(amountPaise / 100).toFixed(2)}`,
            metadata
          }
        ],
        { session }
      );

      return { wallet, transaction, isDuplicate: false };
    };

    if (externalSession) {
      return await executeOperation(externalSession);
    }
    return await runInTransaction(executeOperation);
  }

  /**
   * Admin: View any user's wallet profile and balance
   */
  static async getAdminUserWallet(targetUserId) {
    const user = await User.findById(targetUserId);
    if (!user) {
      throw new AppError("Target user not found.", HTTP_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    const wallet = await this.getOrCreateWallet(targetUserId);
    return { user, wallet };
  }

  /**
   * Admin: Audited manual wallet credit (promotional / customer goodwill)
   */
  static async adminCreditWallet({ adminId, targetUserId, amount, reason, referenceId = null }) {
    if (!reason || !reason.trim()) {
      throw new AppError(
        "A reason is required for administrative wallet adjustments.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const result = await this.creditWallet({
      userId: targetUserId,
      amount,
      referenceType: "ADMIN_CREDIT",
      referenceId: referenceId || `admin_cr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      description: `Administrative credit: ${reason.trim()}`,
      metadata: {
        adjustedByAdminId: adminId,
        adjustmentReason: reason.trim()
      }
    });

    if (!result.isDuplicate) {
      AuditLogger.logFinancialAction({
        action: "ADMIN_WALLET_CREDIT",
        adminId,
        targetUserId,
        amountPaise: result.transaction.amount,
        reason: reason.trim(),
        metadata: { referenceId: result.transaction.referenceId }
      });
    }

    return result;
  }

  /**
   * Admin: Audited manual wallet debit (accounting adjustment / correction)
   */
  static async adminDebitWallet({ adminId, targetUserId, amount, reason, referenceId = null }) {
    if (!reason || !reason.trim()) {
      throw new AppError(
        "A reason is required for administrative wallet adjustments.",
        HTTP_CODES.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const result = await this.debitWallet({
      userId: targetUserId,
      amount,
      referenceType: "ADMIN_DEBIT",
      referenceId: referenceId || `admin_dr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      description: `Administrative debit: ${reason.trim()}`,
      metadata: {
        adjustedByAdminId: adminId,
        adjustmentReason: reason.trim()
      }
    });

    if (!result.isDuplicate) {
      AuditLogger.logFinancialAction({
        action: "ADMIN_WALLET_DEBIT",
        adminId,
        targetUserId,
        amountPaise: result.transaction.amount,
        reason: reason.trim(),
        metadata: { referenceId: result.transaction.referenceId }
      });
    }

    return result;
  }
}

module.exports = WalletService;
