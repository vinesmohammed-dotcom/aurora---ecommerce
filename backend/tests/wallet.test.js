import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import env from "../src/config/env";
import User from "../src/modules/users/user.model";
import Wallet from "../src/modules/wallet/wallet.model";
import WalletTransaction from "../src/modules/wallet/walletTransaction.model";
import WalletService from "../src/modules/wallet/wallet.service";

describe("Phase 7 — Customer Wallet & Append-Only Transaction Ledger (Integration Tests)", () => {
  let userACookie;
  let userBCookie;
  let adminCookie;
  let userAId;
  let userBId;
  let adminId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite"
      );
    }

    await Wallet.syncIndexes();
    await WalletTransaction.syncIndexes();

    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await User.deleteMany({
      email: { $in: ["user.walleta@example.com", "user.walletb@example.com", "admin.wallet@example.com"] }
    });

    // Seed Admin
    const adminPass = await User.hashPassword("AdminPass123!");
    const admin = await User.create({
      name: "Wallet Admin",
      email: "admin.wallet@example.com",
      passwordHash: adminPass,
      role: "ADMIN",
      isVerified: true
    });
    adminId = admin._id.toString();
    const adminRes = await request(app).post("/api/v1/auth/login").send({
      email: "admin.wallet@example.com",
      password: "AdminPass123!"
    });
    adminCookie = adminRes.headers["set-cookie"][0];

    // Seed User A
    const userAPass = await User.hashPassword("UserPass123!");
    const userA = await User.create({
      name: "Customer WalletA",
      email: "user.walleta@example.com",
      passwordHash: userAPass,
      role: "USER",
      isVerified: true
    });
    userAId = userA._id.toString();
    const userARes = await request(app).post("/api/v1/auth/login").send({
      email: "user.walleta@example.com",
      password: "UserPass123!"
    });
    userACookie = userARes.headers["set-cookie"][0];

    // Seed User B
    const userBPass = await User.hashPassword("UserPass123!");
    const userB = await User.create({
      name: "Customer WalletB",
      email: "user.walletb@example.com",
      passwordHash: userBPass,
      role: "USER",
      isVerified: true
    });
    userBId = userB._id.toString();
    const userBRes = await request(app).post("/api/v1/auth/login").send({
      email: "user.walletb@example.com",
      password: "UserPass123!"
    });
    userBCookie = userBRes.headers["set-cookie"][0];
  });

  afterAll(async () => {
    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
    await User.deleteMany({
      email: { $in: ["user.walleta@example.com", "user.walletb@example.com", "admin.wallet@example.com"] }
    });
  });

  it("1. Should auto-create a zero-balance wallet for a user on first query", async () => {
    const res = await request(app)
      .get("/api/v1/wallet")
      .set("Cookie", userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallet).toBeDefined();
    expect(res.body.data.wallet.balance).toBe(0);
    expect(res.body.data.wallet.currency).toBe("INR");
    expect(res.body.data.wallet.userId.toString()).toBe(userAId);
  });

  it("2. Should enforce unique constraint (one wallet per user)", async () => {
    await expect(
      Wallet.create({
        userId: userAId,
        balance: 10000
      })
    ).rejects.toThrow();
  });

  it("3. Should atomically credit wallet with integer paise and create an append-only ledger record (₹500 = 50000 paise)", async () => {
    const result = await WalletService.creditWallet({
      userId: userAId,
      amount: 50000, // 50000 paise = ₹500
      referenceType: "PROMOTIONAL_CREDIT",
      referenceId: "PROMO_WELCOME_500",
      description: "Welcome bonus store credit"
    });

    expect(result.wallet.balance).toBe(50000);
    expect(result.transaction.amount).toBe(50000);
    expect(result.transaction.type).toBe("CREDIT");
    expect(result.transaction.balanceBefore).toBe(0);
    expect(result.transaction.balanceAfter).toBe(50000);
    expect(result.transaction.referenceType).toBe("PROMOTIONAL_CREDIT");
    expect(result.transaction.referenceId).toBe("PROMO_WELCOME_500");

    // Verify persisted record in DB
    const dbWallet = await Wallet.findOne({ userId: userAId });
    expect(dbWallet.balance).toBe(50000);
  });

  it("4. Should atomically debit wallet in integer paise and append transaction record (₹150 = 15000 paise)", async () => {
    const result = await WalletService.debitWallet({
      userId: userAId,
      amount: 15000, // 15000 paise = ₹150
      referenceType: "WALLET_PAYMENT",
      referenceId: "ORD_MOCK_101",
      description: "Store credit used on order"
    });

    expect(result.wallet.balance).toBe(35000); // 35000 paise = ₹350
    expect(result.transaction.amount).toBe(15000);
    expect(result.transaction.type).toBe("DEBIT");
    expect(result.transaction.balanceBefore).toBe(50000);
    expect(result.transaction.balanceAfter).toBe(35000);

    const dbWallet = await Wallet.findOne({ userId: userAId });
    expect(dbWallet.balance).toBe(35000);
  });

  it("5. Should reject debit when balance is insufficient (never allow negative balance)", async () => {
    await expect(
      WalletService.debitWallet({
        userId: userAId,
        amount: 40000, // Balance is 35000 paise (₹350)
        referenceType: "WALLET_PAYMENT",
        referenceId: "ORD_OVERDRAFT_102",
        description: "Attempted overdraft"
      })
    ).rejects.toThrow(/insufficient/i);

    // Balance remains untouched at 35000 paise
    const dbWallet = await Wallet.findOne({ userId: userAId });
    expect(dbWallet.balance).toBe(35000);

    // No orphan ledger record created
    const orphanTx = await WalletTransaction.findOne({ referenceId: "ORD_OVERDRAFT_102" });
    expect(orphanTx).toBeNull();
  });

  it("6. Should reject negative balance at Mongoose model constraint level", async () => {
    const wallet = await Wallet.findOne({ userId: userAId });
    wallet.balance = -5000;
    await expect(wallet.save()).rejects.toThrow();
  });

  it("7. Should enforce compound idempotency constraint (referenceType + referenceId)", async () => {
    // Second attempt with identical referenceType and referenceId should be idempotent (no duplicate balance increment)
    const idempotentResult = await WalletService.creditWallet({
      userId: userAId,
      amount: 50000,
      referenceType: "PROMOTIONAL_CREDIT",
      referenceId: "PROMO_WELCOME_500", // Duplicate!
      description: "Re-credited welcome bonus"
    });

    expect(idempotentResult.isDuplicate).toBe(true);

    // Balance must still be 35000 paise (no double credit)
    const dbWallet = await Wallet.findOne({ userId: userAId });
    expect(dbWallet.balance).toBe(35000);
  });

  it("8. Should fetch paginated transaction history for the authenticated user", async () => {
    const res = await request(app)
      .get("/api/v1/wallet/transactions?page=1&limit=10")
      .set("Cookie", userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactions.length).toBe(2); // 1 credit, 1 debit
    expect(res.body.data.pagination.total).toBe(2);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.transactions[0].type).toBe("DEBIT"); // Most recent first
  });

  it("9. Anti-IDOR: Customer B has an independent wallet and cannot see Customer A's transactions", async () => {
    const resB = await request(app)
      .get("/api/v1/wallet")
      .set("Cookie", userBCookie);

    expect(resB.status).toBe(200);
    expect(resB.body.data.wallet.balance).toBe(0);

    const txB = await request(app)
      .get("/api/v1/wallet/transactions")
      .set("Cookie", userBCookie);

    expect(txB.status).toBe(200);
    expect(txB.body.data.transactions.length).toBe(0);
  });

  it("10. Admin credit: Admin should successfully credit a user's wallet with audit tracking (₹1000 = 100000 paise)", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/wallets/${userBId}/credit`)
      .set("Cookie", adminCookie)
      .send({
        amount: 100000, // 100000 paise = ₹1000
        reason: "Customer goodwill compensation"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallet.balance).toBe(100000);
    expect(res.body.data.transaction.referenceType).toBe("ADMIN_CREDIT");
    expect(res.body.data.transaction.metadata.adjustedByAdminId.toString()).toBe(adminId);

    const dbWalletB = await Wallet.findOne({ userId: userBId });
    expect(dbWalletB.balance).toBe(100000);
  });

  it("11. Admin debit: Admin should successfully debit a user's wallet (₹300 = 30000 paise)", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/wallets/${userBId}/debit`)
      .set("Cookie", adminCookie)
      .send({
        amount: 30000, // 30000 paise = ₹300
        reason: "Manual correction of duplicate promotion"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallet.balance).toBe(70000); // 70000 paise = ₹700
    expect(res.body.data.transaction.referenceType).toBe("ADMIN_DEBIT");

    const dbWalletB = await Wallet.findOne({ userId: userBId });
    expect(dbWalletB.balance).toBe(70000);
  });

  it("12. Security: Non-admin user cannot access admin wallet endpoints", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/wallets/${userAId}/credit`)
      .set("Cookie", userACookie)
      .send({
        amount: 500000,
        reason: "Hacker trying to credit own wallet"
      });

    expect(res.status).toBe(403);
  });

  it("13. Wallet Balance Consistency: balance must exactly equal sum of all credits minus debits", async () => {
    const allTransactions = await WalletTransaction.find({ userId: userAId });
    const totalCredits = allTransactions
      .filter((tx) => tx.type === "CREDIT")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalDebits = allTransactions
      .filter((tx) => tx.type === "DEBIT")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const wallet = await Wallet.findOne({ userId: userAId });
    expect(wallet.balance).toBe(totalCredits - totalDebits);
  });

  it("14. Distinct business events with unique references must not be blocked", async () => {
    const res1 = await WalletService.creditWallet({
      userId: userAId,
      amount: 10000,
      referenceType: "ADMIN_CREDIT",
      referenceId: "admin_ref_event_001",
      description: "First independent credit"
    });
    expect(res1.isDuplicate).toBe(false);

    const res2 = await WalletService.creditWallet({
      userId: userAId,
      amount: 15000,
      referenceType: "ADMIN_CREDIT",
      referenceId: "admin_ref_event_002",
      description: "Second independent credit"
    });
    expect(res2.isDuplicate).toBe(false);

    // Third attempt re-submitting event_001 must be recognized as duplicate
    const res3 = await WalletService.creditWallet({
      userId: userAId,
      amount: 10000,
      referenceType: "ADMIN_CREDIT",
      referenceId: "admin_ref_event_001",
      description: "Duplicate first credit"
    });
    expect(res3.isDuplicate).toBe(true);
  });
});
