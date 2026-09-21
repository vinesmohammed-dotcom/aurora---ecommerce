import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import User from "../src/modules/users/user.model";
import Brand from "../src/modules/brands/brand.model";

describe("Phase 3 — Brands API (Integration Tests)", () => {
  let adminCookie = "";
  let userCookie = "";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    await Brand.deleteMany({});
    await User.deleteMany({ email: { $in: ["brand.admin@example.com", "brand.user@example.com"] } });

    // Seed Admin
    await User.create({
      name: "Brand Admin",
      email: "brand.admin@example.com",
      passwordHash: await User.hashPassword("AdminPass123!"),
      role: "ADMIN",
      isVerified: true
    });

    // Seed Normal User
    await User.create({
      name: "Brand User",
      email: "brand.user@example.com",
      passwordHash: await User.hashPassword("UserPass123!"),
      role: "USER",
      isVerified: true
    });

    // Login Admin
    const adminLogin = await request(app).post("/api/v1/auth/login").send({
      email: "brand.admin@example.com",
      password: "AdminPass123!"
    });
    adminCookie = adminLogin.headers["set-cookie"][0];

    // Login User
    const userLogin = await request(app).post("/api/v1/auth/login").send({
      email: "brand.user@example.com",
      password: "UserPass123!"
    });
    userCookie = userLogin.headers["set-cookie"][0];
  });

  afterAll(async () => {
    await Brand.deleteMany({});
    await User.deleteMany({ email: { $in: ["brand.admin@example.com", "brand.user@example.com"] } });
  });

  describe("Admin Brand Operations", () => {
    let createdBrandId = "";

    it("should allow admin to create a brand", async () => {
      const res = await request(app)
        .post("/api/v1/admin/brands")
        .set("Cookie", adminCookie)
        .send({
          name: "Nike",
          logoUrl: "https://images.example.com/nike-logo.png",
          description: "Global athletic apparel and footwear"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Nike");
      expect(res.body.data.slug).toBe("nike");
      createdBrandId = res.body.data._id;
    });

    it("should reject duplicate brand name", async () => {
      const res = await request(app)
        .post("/api/v1/admin/brands")
        .set("Cookie", adminCookie)
        .send({
          name: "Nike"
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should allow admin to toggle brand status", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/brands/${createdBrandId}/status`)
        .set("Cookie", adminCookie)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);

      // Re-activate
      await request(app)
        .patch(`/api/v1/admin/brands/${createdBrandId}/status`)
        .set("Cookie", adminCookie)
        .send({ isActive: true });
    });

    it("should reject non-admin from creating brand", async () => {
      const res = await request(app)
        .post("/api/v1/admin/brands")
        .set("Cookie", userCookie)
        .send({
          name: "Unauthorized Brand"
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Public Brand Operations", () => {
    beforeAll(async () => {
      await Brand.create([
        { name: "Adidas", slug: "adidas", isActive: true },
        { name: "Deactivated Brand", slug: "deactivated-brand", isActive: false }
      ]);
    });

    it("should return only active brands for customers", async () => {
      const res = await request(app).get("/api/v1/brands");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const slugs = res.body.data.map((b) => b.slug);
      expect(slugs).toContain("nike");
      expect(slugs).toContain("adidas");
      expect(slugs).not.toContain("deactivated-brand");
    });
  });
});
