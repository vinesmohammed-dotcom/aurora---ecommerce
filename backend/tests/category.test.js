import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import User from "../src/modules/users/user.model";
import Category from "../src/modules/categories/category.model";

describe("Phase 3 — Categories API (Integration Tests)", () => {
  let adminCookie = "";
  let userCookie = "";

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    // Clean up
    await Category.deleteMany({});
    await User.deleteMany({ email: { $in: ["cat.admin@example.com", "cat.user@example.com"] } });

    // Seed Admin
    const admin = await User.create({
      name: "Category Admin",
      email: "cat.admin@example.com",
      passwordHash: await User.hashPassword("AdminPass123!"),
      role: "ADMIN",
      isVerified: true
    });

    // Seed Normal User
    const user = await User.create({
      name: "Normal User",
      email: "cat.user@example.com",
      passwordHash: await User.hashPassword("UserPass123!"),
      role: "USER",
      isVerified: true
    });

    // Login Admin
    const adminLogin = await request(app).post("/api/v1/auth/login").send({
      email: "cat.admin@example.com",
      password: "AdminPass123!"
    });
    adminCookie = adminLogin.headers["set-cookie"][0];

    // Login User
    const userLogin = await request(app).post("/api/v1/auth/login").send({
      email: "cat.user@example.com",
      password: "UserPass123!"
    });
    userCookie = userLogin.headers["set-cookie"][0];
  });

  afterAll(async () => {
    await Category.deleteMany({});
    await User.deleteMany({ email: { $in: ["cat.admin@example.com", "cat.user@example.com"] } });
  });

  describe("Admin Category Operations", () => {
    let createdCategoryId = "";

    it("should allow admin to create a new category", async () => {
      const res = await request(app)
        .post("/api/v1/admin/categories")
        .set("Cookie", adminCookie)
        .send({
          name: "Footwear",
          description: "Athletic and casual shoes",
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Footwear");
      expect(res.body.data.slug).toBe("footwear");
      createdCategoryId = res.body.data._id;
    });

    it("should reject duplicate category name with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/v1/admin/categories")
        .set("Cookie", adminCookie)
        .send({
          name: "Footwear",
          description: "Duplicate check"
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should allow admin to update a category", async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/categories/${createdCategoryId}`)
        .set("Cookie", adminCookie)
        .send({
          description: "Updated footwear description"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe("Updated footwear description");
    });

    it("should reject regular user from creating category with 403 Forbidden", async () => {
      const res = await request(app)
        .post("/api/v1/admin/categories")
        .set("Cookie", userCookie)
        .send({
          name: "Hacked Category"
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const res = await request(app)
        .post("/api/v1/admin/categories")
        .send({
          name: "Anonymous Category"
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Public Category Operations", () => {
    beforeAll(async () => {
      await Category.create([
        { name: "Electronics", slug: "electronics", isActive: true },
        { name: "Secret Lab", slug: "secret-lab", isActive: false }
      ]);
    });

    it("should return only active categories to public customers", async () => {
      const res = await request(app).get("/api/v1/categories");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const slugs = res.body.data.map((c) => c.slug);
      expect(slugs).toContain("footwear");
      expect(slugs).toContain("electronics");
      expect(slugs).not.toContain("secret-lab"); // Inactive category must be hidden
    });
  });
});
