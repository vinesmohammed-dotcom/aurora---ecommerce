# Project Status & Master Blueprint Tracker

## 1. Project Objective
Build and deploy an enterprise-grade, full-stack MERN e-commerce application to AWS to serve as a flagship portfolio project for senior engineering interviews. The project emphasizes clean modular monolith architecture, strict separation of concerns (MVC + Service layer), robust concurrency safeguards, PCI-compliant payment integrations, and beginner-friendly maintainability.

---

## 2. Current Status
- **Current Phase**: **PHASE 4: Addresses, Dynamic Cart, Wishlist & Stock Concurrency (COMPLETED & VERIFIED)**
- **Next Phase**: **PHASE 5: Multi-Stage Checkout Pipeline & Coupons**
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
  - Customer Address Module: Full CRUD, single default address rule, automatic promotion upon deletion, anti-IDOR session scoping returning 404.
  - Dynamic Shopping Cart: Live catalog-reconciled prices, client prices completely ignored, stale stock detection, quantity boundary limits (1–10).
  - Wishlist Module: `$addToSet` set uniqueness, live product details, move-to-cart orchestration.
  - Atomic Stock Concurrency Guard: `StockService.decrementVariantStock` with `{ stock: { $gte: qty } }` and `{ $inc: { stock: -qty } }`, verified with concurrent `Promise.all` tests.
  - Automated integration test suite using **Vitest** and **Supertest** passing 90/90 tests across 9 test files (100%).
  - Frontend upgraded to **React 19.3.0, Vite 8.3.0, Tailwind CSS, Redux Toolkit, and React Router**.
  - Complete customer Shop page, Cart page, Wishlist page, Profile Address dashboard, and Admin management interfaces.
  - Verified frontend production build compiling cleanly in 2.01s with zero errors.

---

## 3. Planning & Implementation Summary

| Phase | Description | Status | Reference Deliverable |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Requirements, Architecture & Blueprint | **Completed** | [phase-00-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-00-report.md) |
| **Phase 1** | Technical Foundation & Scaffolding | **Completed** | [phase-01-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-01-report.md) |
| **Phase 2** | Customer Auth & Account Management | **Completed** | [phase-02-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-02-report.md) |
| **Phase 3** | Product Catalog, Search & Filtering | **Completed** | [phase-03-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-03-report.md) |
| **Phase 4** | Cart, Wishlist & Concurrency | **Completed** | [phase-04-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-04-report.md) |
| **Phase 5** | Multi-Stage Checkout & Coupons | *Pending* | Phase 5 Blueprint |
| **Phase 6** | Razorpay Payments & Webhooks | *Pending* | Phase 6 Blueprint |
| **Phase 7** | Order Management & Invoices | *Pending* | Phase 7 Blueprint |
| **Phase 8** | Customer Wallet & Immutable Ledger | *Pending* | Phase 8 Blueprint |
| **Phase 9** | Admin Operations & Sales Reports | *Pending* | Phase 9 Blueprint |
| **Phase 10**| AWS Production Deployment (EC2, Nginx, PM2)| *Pending* | Phase 10 Blueprint |

---

## 4. Phase 4 Verification Summary
- **Backend Test Suite (`npm test`)**: Passed 90/90 tests across 9 test files in 44.47s.
  - `tests/health.test.js`: 3 tests passed.
  - `tests/auth.test.js`: 22 tests passed.
  - `tests/brand.test.js`: 5 tests passed.
  - `tests/category.test.js`: 6 tests passed.
  - `tests/product.test.js`: 22 tests passed.
  - `tests/address.test.js`: 10 tests passed (CRUD, default address rules, anti-IDOR 404 security).
  - `tests/cart.test.js`: 13 tests passed (Add, quantity limits, live price derivation, wholesale margin stripping, stale stock detection, clear cart).
  - `tests/wishlist.test.js`: 7 tests passed ($addToSet uniqueness, availability flag, remove, toggle).
  - `tests/concurrency.test.js`: 2 tests passed (Atomic race condition protection under concurrent requests).
- **Frontend Production Build (`npm run build`)**: Compiled successfully to `frontend/dist` in 2.01s (Vite 8.3.0 + React 19.3.0).
- **Git State**: Clean commit ready for Phase 5.
