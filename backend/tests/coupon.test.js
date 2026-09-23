import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import env from "../src/config/env";
import User from "../src/modules/users/user.model";
import Coupon from "../src/modules/coupons/coupon.model";
import CouponService from "../src/modules/coupons/coupon.service";

describe("Phase 5 — Promotional Coupons & Authoritative Limits (Integration Tests)", () => {
  let adminCookie;
  let userCookie;
  let userId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    await Coupon.syncIndexes();
    await Coupon.deleteMany({});
    await User.deleteMany({ email: { $in: ["admin.coupon@example.com", "user.coupon@example.com"] } });

    // Seed Admin
    const adminPass = await User.hashPassword("AdminPass123!");
    await User.create({
      name: "Coupon Admin",
      email: "admin.coupon@example.com",
      passwordHash: adminPass,
      role: "ADMIN",
      isVerified: true
    });

    const adminAuthRes = await request(app).post("/api/v1/auth/login").send({
      email: "admin.coupon@example.com",
      password: "AdminPass123!"
    });
    adminCookie = adminAuthRes.headers["set-cookie"][0];

    // Seed User
    const userPass = await User.hashPassword("UserPass123!");
    const user = await User.create({
      name: "Coupon User",
      email: "user.coupon@example.com",
      passwordHash: userPass,
      role: "USER",
      isVerified: true
    });
    userId = user._id.toString();

    const userAuthRes = await request(app).post("/api/v1/auth/login").send({
      email: "user.coupon@example.com",
      password: "UserPass123!"
    });
    userCookie = userAuthRes.headers["set-cookie"][0];
  });

  afterAll(async () => {
    await Coupon.deleteMany({});
    await User.deleteMany({ email: { $in: ["admin.coupon@example.com", "user.coupon@example.com"] } });
  });

  describe("Coupon Creation & Validation Engine", () => {
    it("Admin can create a valid percentage coupon with max discount cap", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 10);

      const res = await request(app)
        .post("/api/v1/admin/coupons")
        .set("Cookie", adminCookie)
        .send({
          code: "FESTIVE50",
          description: "50% off up to ₹500 on orders above ₹1000",
          discountType: "PERCENTAGE",
          discountValue: 50,
          minOrderValue: 1000,
          maxDiscount: 500,
          expiryDate: tomorrow.toISOString(),
          usageLimit: 100,
          perUserLimit: 1
        });

      expect(res.status).toBe(201);
      expect(res.body.data.coupon.code).toBe("FESTIVE50");
      expect(res.body.data.coupon.discountValue).toBe(50);
    });

    it("Rejects duplicate coupon code creation (409 Conflict)", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 10);

      const res = await request(app)
        .post("/api/v1/admin/coupons")
        .set("Cookie", adminCookie)
        .send({
          code: "FESTIVE50", // duplicate
          discountType: "PERCENTAGE",
          discountValue: 10,
          expiryDate: tomorrow.toISOString()
        });

      expect(res.status).toBe(409);
    });

    it("Applies max discount cap accurately for percentage discounts", async () => {
      // 50% on ₹3,000 would be ₹1,500, but maxDiscount is ₹500
      const result = await CouponService.validateCouponForCart({
        code: "FESTIVE50",
        userId,
        cartSubtotal: 3000
      });

      expect(result.discountAmount).toBe(500); // capped at 500!
    });

    it("Enforces minimum order value threshold", async () => {
      // minOrderValue is 1000, subtotal is 800
      await expect(
        CouponService.validateCouponForCart({
          code: "FESTIVE50",
          userId,
          cartSubtotal: 800
        })
      ).rejects.toThrow("does not meet the minimum order value of ₹1000");
    });

    it("Rejects expired coupons", async () => {
      const past = new Date();
      past.setDate(past.getDate() - 2);

      await Coupon.create({
        code: "EXPIRED20",
        discountType: "FLAT",
        discountValue: 200,
        startDate: new Date(Date.now() - 100000),
        expiryDate: past,
        isActive: true
      });

      await expect(
        CouponService.validateCouponForCart({
          code: "EXPIRED20",
          userId,
          cartSubtotal: 1500
        })
      ).rejects.toThrow("has expired");
    });

    it("Enforces global usage limit", async () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);

      await Coupon.create({
        code: "LIMITED10",
        discountType: "FLAT",
        discountValue: 100,
        expiryDate: future,
        usageLimit: 2,
        usedCount: 2, // Reached limit
        isActive: true
      });

      await expect(
        CouponService.validateCouponForCart({
          code: "LIMITED10",
          userId,
          cartSubtotal: 500
        })
      ).rejects.toThrow("maximum global usage limit");
    });

    it("Enforces per-user redemption limit", async () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);

      const coupon = await Coupon.create({
        code: "ONEPERUSER",
        discountType: "FLAT",
        discountValue: 150,
        expiryDate: future,
        perUserLimit: 1,
        userUsage: [{ userId, count: 1 }], // User already redeemed once
        isActive: true
      });

      await expect(
        CouponService.validateCouponForCart({
          code: "ONEPERUSER",
          userId,
          cartSubtotal: 1000
        })
      ).rejects.toThrow("maximum allowed (1) time(s)");
    });

    it("Atomically prevents concurrent requests from exceeding per-user limit", async () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);

      await Coupon.create({
        code: "CONCURRENT_PER_USER",
        discountType: "FLAT",
        discountValue: 100,
        expiryDate: future,
        usageLimit: 10,
        perUserLimit: 1,
        usedCount: 0,
        userUsage: [],
        isActive: true
      });

      // Run two concurrent redemption requests for the SAME user
      const results = await Promise.allSettled([
        CouponService.recordCouponUsage({ code: "CONCURRENT_PER_USER", userId }),
        CouponService.recordCouponUsage({ code: "CONCURRENT_PER_USER", userId })
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly one must succeed, one must fail!
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify coupon document in DB has exactly 1 usage
      const updated = await Coupon.findOne({ code: "CONCURRENT_PER_USER" });
      expect(updated.usedCount).toBe(1);
      expect(updated.userUsage.length).toBe(1);
      expect(updated.userUsage[0].count).toBe(1);
    });

    it("Atomically prevents concurrent requests from exceeding global usage limit", async () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);

      await Coupon.create({
        code: "CONCURRENT_GLOBAL",
        discountType: "FLAT",
        discountValue: 100,
        expiryDate: future,
        usageLimit: 1, // Only 1 total globally
        perUserLimit: 1,
        usedCount: 0,
        userUsage: [],
        isActive: true
      });

      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();

      // Run two concurrent redemption requests for DIFFERENT users
      const results = await Promise.allSettled([
        CouponService.recordCouponUsage({ code: "CONCURRENT_GLOBAL", userId: user1 }),
        CouponService.recordCouponUsage({ code: "CONCURRENT_GLOBAL", userId: user2 })
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly one must succeed, one must fail!
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const updated = await Coupon.findOne({ code: "CONCURRENT_GLOBAL" });
      expect(updated.usedCount).toBe(1);
    });
  });
});
