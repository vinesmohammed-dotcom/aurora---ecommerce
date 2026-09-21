# Project Status & Master Blueprint Tracker

## 1. Project Objective
Build and deploy an enterprise-grade, full-stack MERN e-commerce application to AWS to serve as a flagship portfolio project for senior engineering interviews. The project emphasizes clean modular monolith architecture, strict separation of concerns (MVC + Service layer), robust concurrency safeguards, PCI-compliant payment integrations, and beginner-friendly maintainability.

---

## 2. Current Status
- **Current Phase**: **PHASE 5: Multi-Stage Checkout Pipeline, Coupons, Offers, Orders & COD Ordering (COMPLETED & VERIFIED)**
- **Next Phase**: **PHASE 6: Online Payments Integration (Razorpay) & Webhooks**
- **Tested Foundations**:
  - Express 5 application cleanly decoupled from HTTP server (`app.js` vs `server.js`).
  - Dual healthcheck probes: Liveness (`GET /api/v1/health`) and Readiness (`GET /api/v1/health/ready`).
  - Mongoose connection and MongoDB session store (`connect-mongo`) with `httpOnly`, `sameSite: 'lax'` cookies.
  - Security middlewares: Helmet, strict CORS, body limits (`10kb`), tiered rate limiting (`apiRateLimiter`, `authLimiter`, `otpLimiter`).
  - Centralized operational error handling (`AppError`, Express 5 native async routing, `errorMiddleware`, Zod 422 mapping).
  - User model with bcrypt 12 salt rounds (adaptive cost factor), `select: false` on passwordHash, custom `toJSON` stripping secrets.
  - OTP model with server-secret keyed HMAC-SHA256 hash storage (`crypto.timingSafeEqual`), 5-minute MongoDB TTL index, attempt limits.
  - Complete authentication flows: registration, OTP verification, resend, login, logout, `/me`, uniform forgot password, reset password, change password, email change.
  - Product Catalog architecture: Categories, Brands, Products with embedded variants (`variants: [variantSchema]`).
  - Standardized Product model on `name` with backwards-compatible `title` virtual getter/setter, `tags: [String]`, compound text index `{ name: "text", description: "text", tags: "text" }`.
  - Dual-level SKU uniqueness protection: sparse unique index across products + application-level validation within product document.
  - Critical Data Protection: Public endpoints strictly project away `costPrice` via `.select('-variants.costPrice')`. Admin routes retain wholesale margin metrics.
  - Unique sparse index on `variants.sku`, compound ESR indexes on `{ category, isActive, basePrice }`, text search index.
  - Customer Address Module: Full CRUD, single default address rule via MongoDB partial filter index `{ userId: 1 }, { unique: true, partialFilterExpression: { isDefault: true } }`, automatic promotion upon deletion, anti-IDOR session scoping returning 404.
  - Dynamic Shopping Cart: Live catalog-reconciled prices, client prices completely ignored, stale stock detection, quantity boundary limits (1–10), unique index on `userId`.
  - Wishlist Module: `$addToSet` set uniqueness, unique index on `userId`, live product details, move-to-cart orchestration.
  - Atomic Variant Stock Concurrency Guard: `StockService.decrementVariantStock` with `$elemMatch: { _id: variantId, stock: { $gte: qty } }` and `$inc: { "variants.$.stock": -qty }`, verified with concurrent `Promise.all` tests across multi-variant documents.
  - Server-Authoritative Checkout Pipeline: Multi-stage checkout calculation engine re-evaluating live prices, variant validity, active offers, coupons, and tiered shipping.
  - Promotional Offers: Category and Product level percentage discounts with deterministic, non-stacking resolution (higher percentage wins).
  - Promotional Coupons: Percentage and Flat discounts with minimum cart value, maximum discount caps, global usage limits, and per-user redemption quotas.
  - Integer Minor Units (Paise) Arithmetic: Server calculations execute strictly in whole integers (`Math.round`) to eliminate IEEE-754 floating-point inaccuracies.
  - Orders Module: Frozen historical snapshots for items, prices, and shipping addresses. Multi-item atomic inventory reservation with compensation rollback on failure.
  - State Machine Lifecycle: Explicit allowed transitions (`CONFIRMED` -> `PROCESSING` -> `SHIPPED` -> `DELIVERED` or `CANCELLED`). Idempotent order cancellation automatically restores warehouse inventory.
  - Client Idempotency Keys: Enforces duplicate submission protection for checkout and COD order placement.
  - Automated integration test suite using **Vitest** and **Supertest** passing 124/124 tests across 13 test files (100%).
  - Complete customer Checkout, Orders history, and Admin management interfaces for Offers, Coupons, and Orders.
  - Verified frontend production build compiling cleanly in 2.36s with zero errors.

---

## 3. Planning & Implementation Summary

| Phase | Description | Status | Reference Deliverable |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Requirements, Architecture & Blueprint | **Completed** | [phase-00-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-00-report.md) |
| **Phase 1** | Technical Foundation & Scaffolding | **Completed** | [phase-01-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-01-report.md) |
| **Phase 2** | Customer Auth & Account Management | **Completed** | [phase-02-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-02-report.md) |
| **Phase 3** | Product Catalog, Search & Filtering | **Completed** | [phase-03-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-03-report.md) |
| **Phase 4** | Cart, Wishlist & Concurrency | **Completed** | [phase-04-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-04-report.md) |
| **Phase 5** | Checkout, Coupons, Offers, Orders & COD | **Completed** | [phase-05-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-05-report.md) |
| **Phase 6** | Razorpay Payments & Webhooks | *Pending* | Phase 6 Blueprint |
| **Phase 7** | Advanced Order Management & Invoices | *Pending* | Phase 7 Blueprint |
| **Phase 8** | Customer Wallet & Immutable Ledger | *Pending* | Phase 8 Blueprint |
| **Phase 9** | Admin Operations & Sales Reports | *Pending* | Phase 9 Blueprint |
| **Phase 10**| AWS Production Deployment (EC2, Nginx, PM2)| *Pending* | Phase 10 Blueprint |

---

## 4. Phase 5 Verification Summary
- **Backend Test Suite (`npm test`)**: Passed 124/124 tests across 13 test files in 55.48s.
  - `tests/health.test.js`: 3 tests passed.
  - `tests/auth.test.js`: 22 tests passed.
  - `tests/brand.test.js`: 5 tests passed.
  - `tests/category.test.js`: 6 tests passed.
  - `tests/product.test.js`: 22 tests passed.
  - `tests/address.test.js`: 10 tests passed (CRUD, default address partial filter index, anti-IDOR).
  - `tests/cart.test.js`: 14 tests passed (Add, quantity limits, live price derivation, unique user index, duplicate race handling).
  - `tests/wishlist.test.js`: 8 tests passed ($addToSet uniqueness, unique user index, duplicate race handling).
  - `tests/concurrency.test.js`: 3 tests passed (Atomic race condition protection with `$elemMatch`, multi-variant condition isolation).
  - `tests/offer.test.js`: 6 tests passed (CRUD, temporal validity, non-stacking precedence).
  - `tests/coupon.test.js`: 7 tests passed (CRUD, MOV, discount caps, global & per-user usage limits).
  - `tests/checkout.test.js`: 4 tests passed (Authoritative pricing, offer & coupon resolution, tiered shipping).
  - `tests/order.test.js`: 9 tests passed (COD placement, frozen snapshots, atomic multi-item stock reservation with compensation rollback, idempotency keys, state machine, stock restoration on cancellation).
- **Frontend Production Build (`npm run build`)**: Compiled successfully to `frontend/dist` in 2.36s (Vite 8.3.0 + React 19.3.0).
- **Git State**: Clean commit ready for Phase 6.
