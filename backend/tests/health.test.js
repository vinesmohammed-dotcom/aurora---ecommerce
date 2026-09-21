import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("GET /api/v1/health (Smoke Test)", () => {
  it("should return 200 OK with expected standard envelope and health status", async () => {
    // Note: app is imported directly without starting the HTTP server or connecting to live MongoDB
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toBeTypeOf("object");
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("API is healthy");
    expect(response.body.data).toBeTypeOf("object");
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data).toHaveProperty("timestamp");
    expect(response.body.data).toHaveProperty("uptimeSeconds");
    expect(response.body.data).toHaveProperty("database");
  });

  it("should return 404 NOT_FOUND for non-existent API routes in standard error format", async () => {
    const response = await request(app).get("/api/v1/non-existent-route");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe("NOT_FOUND");
    expect(response.body.message).toContain("Cannot find endpoint");
  });
});
