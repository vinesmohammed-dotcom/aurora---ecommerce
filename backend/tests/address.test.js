import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import env from "../src/config/env";
import User from "../src/modules/users/user.model";
import Address from "../src/modules/addresses/address.model";

describe("Phase 4 — Address Management & IDOR Security (Integration Tests)", () => {
  let userACookie;
  let userBCookie;
  let userAId;
  let userBId;
  let addressA1Id;
  let addressA2Id;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecommerce_test_suite");
    }

    // Clean prior test artifacts
    await Address.deleteMany({});
    await User.deleteMany({ email: { $in: ["user.a@example.com", "user.b@example.com"] } });

    // Create User A
    const passwordHashA = await User.hashPassword("ValidPass123!");
    const userA = await User.create({
      name: "Customer Alpha",
      email: "user.a@example.com",
      passwordHash: passwordHashA,
      isVerified: true
    });
    userAId = userA._id.toString();

    // Create User B
    const passwordHashB = await User.hashPassword("ValidPass123!");
    const userB = await User.create({
      name: "Customer Beta",
      email: "user.b@example.com",
      passwordHash: passwordHashB,
      isVerified: true
    });
    userBId = userB._id.toString();

    const authARes = await request(app).post("/api/v1/auth/login").send({
      email: "user.a@example.com",
      password: "ValidPass123!"
    });
    userACookie = authARes.headers["set-cookie"][0];

    const authBRes = await request(app).post("/api/v1/auth/login").send({
      email: "user.b@example.com",
      password: "ValidPass123!"
    });
    userBCookie = authBRes.headers["set-cookie"][0];
  });

  afterAll(async () => {
    await Address.deleteMany({});
    await User.deleteMany({ email: { $in: ["user.a@example.com", "user.b@example.com"] } });
  });

  describe("Address Creation & Default Rules", () => {
    it("should allow authenticated user to create their first address and auto-set it as default", async () => {
      const res = await request(app)
        .post("/api/v1/addresses")
        .set("Cookie", userACookie)
        .send({
          fullName: "Customer Alpha",
          phone: "+91 9876543210",
          addressLine1: "123 Tech Park Avenue",
          addressLine2: "Suite 4B",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "India",
          label: "HOME"
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.address.fullName).toBe("Customer Alpha");
      expect(res.body.data.address.isDefault).toBe(true); // First address is automatically default
      addressA1Id = res.body.data.address._id;
    });

    it("should create a second address without marking it default by default", async () => {
      const res = await request(app)
        .post("/api/v1/addresses")
        .set("Cookie", userACookie)
        .send({
          fullName: "Alpha Office",
          phone: "+91 9876543210",
          addressLine1: "456 Corporate Towers",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560002",
          label: "WORK",
          isDefault: false
        });

      expect(res.status).toBe(201);
      expect(res.body.data.address.isDefault).toBe(false);
      addressA2Id = res.body.data.address._id;

      // Verify first address is STILL the only default
      const firstAddr = await Address.findById(addressA1Id);
      expect(firstAddr.isDefault).toBe(true);
    });

    it("should atomically unset prior default when setting a new default address", async () => {
      const res = await request(app)
        .patch(`/api/v1/addresses/${addressA2Id}/default`)
        .set("Cookie", userACookie);

      expect(res.status).toBe(200);
      expect(res.body.data.address.isDefault).toBe(true);

      // Verify prior default is now false
      const priorAddr = await Address.findById(addressA1Id);
      expect(priorAddr.isDefault).toBe(false);

      // Verify exactly ONE address is default for User A
      const defaultCount = await Address.countDocuments({ userId: userAId, isDefault: true });
      expect(defaultCount).toBe(1);
    });

    it("should list all addresses for authenticated user sorted with default first", async () => {
      const res = await request(app)
        .get("/api/v1/addresses")
        .set("Cookie", userACookie);

      expect(res.status).toBe(200);
      expect(res.body.data.addresses.length).toBe(2);
      expect(res.body.data.addresses[0]._id).toBe(addressA2Id); // Default address comes first
      expect(res.body.data.addresses[0].isDefault).toBe(true);
    });
  });

  describe("Address Updates & Deletion", () => {
    it("should update address fields successfully", async () => {
      const res = await request(app)
        .put(`/api/v1/addresses/${addressA1Id}`)
        .set("Cookie", userACookie)
        .send({
          fullName: "Customer Alpha Renamed",
          phone: "+91 9876543211",
          addressLine1: "789 Upgraded Boulevard"
        });

      expect(res.status).toBe(200);
      expect(res.body.data.address.fullName).toBe("Customer Alpha Renamed");
      expect(res.body.data.address.addressLine1).toBe("789 Upgraded Boulevard");
    });

    it("should promote another address to default when deleting the current default address", async () => {
      // addressA2Id is currently default. Delete it.
      const res = await request(app)
        .delete(`/api/v1/addresses/${addressA2Id}`)
        .set("Cookie", userACookie);

      expect(res.status).toBe(200);

      // Verify addressA1Id was promoted to default
      const remaining = await Address.findById(addressA1Id);
      expect(remaining.isDefault).toBe(true);
    });
  });

  describe("Anti-IDOR Security & Ownership Enforcements", () => {
    it("CRITICAL: User B cannot access User A's address by ID (404/Not Found)", async () => {
      const res = await request(app)
        .get(`/api/v1/addresses/${addressA1Id}`)
        .set("Cookie", userBCookie);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("CRITICAL: User B cannot update User A's address (404/Not Found)", async () => {
      const res = await request(app)
        .put(`/api/v1/addresses/${addressA1Id}`)
        .set("Cookie", userBCookie)
        .send({
          fullName: "Hacker Modification",
          addressLine1: "Malicious Location"
        });

      expect(res.status).toBe(404);
      // Verify database record was unchanged
      const addr = await Address.findById(addressA1Id);
      expect(addr.fullName).not.toBe("Hacker Modification");
    });

    it("CRITICAL: User B cannot delete User A's address (404/Not Found)", async () => {
      const res = await request(app)
        .delete(`/api/v1/addresses/${addressA1Id}`)
        .set("Cookie", userBCookie);

      expect(res.status).toBe(404);
      const addr = await Address.findById(addressA1Id);
      expect(addr).not.toBeNull();
    });

    it("should reject unauthenticated requests to address endpoints with 401", async () => {
      const res = await request(app).get("/api/v1/addresses");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });
  });
});
