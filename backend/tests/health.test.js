import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("Health & Readiness Endpoints (Smoke Test)", () => {
  it("GET /api/v1/health should return 200 OK for process liveness", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toBeTypeOf("object");
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Process is alive and healthy");
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data).toHaveProperty("timestamp");
    expect(response.body.data).toHaveProperty("uptimeSeconds");
    expect(response.body.data).toHaveProperty("processId");
  });

  it("GET /api/v1/health/live should return 200 OK for container liveness probe", async () => {
    const response = await request(app).get("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Process is alive and healthy");
    expect(response.body.data.status).toBe("ok");
  });

  it("GET /api/v1/health/ready should return 503 SERVICE_UNAVAILABLE when DB is disconnected in test environment", async () => {
    // In standalone unit tests without live MongoDB connection, readiness properly reports not_ready
    const response = await request(app).get("/api/v1/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("Service is not ready");
    expect(response.body.data.status).toBe("not_ready");
    expect(response.body.data.database).toBe("disconnected");
  });

  it("GET /api/v1/non-existent-route should return 404 NOT_FOUND in standard error format", async () => {
    const response = await request(app).get("/api/v1/non-existent-route");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe("NOT_FOUND");
    expect(response.body.message).toContain("Cannot find endpoint");
  });
});
