# Project Status & Master Blueprint Tracker

## 1. Project Objective
Build and deploy an enterprise-grade, full-stack MERN e-commerce application to AWS to serve as a flagship portfolio project for senior engineering interviews. The project emphasizes clean modular monolith architecture, strict separation of concerns (MVC + Service layer), robust concurrency safeguards, PCI-compliant payment integrations, and beginner-friendly maintainability.

---

## 2. Current Status
- **Current Status**: **Production deployment prepared; application code and browser tests locally verified; container and AWS deployment not yet verified.**
- **Phase 10 Status**: **Phase 10 implementation, verification audit, and browser smoke test suite complete. AWS deployment remains pending, and local Docker verification has not yet been executed.**
- **Verification Matrix**:
  - **Application implementation**: Complete
  - **Security hardening**: Complete
  - **Container configuration**: Prepared (runtime verification pending)
  - **Browser E2E verification**: Complete (6/6 smoke tests passing)
  - **Local Docker runtime verification**: Pending
  - **AWS deployment**: Pending
- **Tested Foundations**:
  - Express 5 application cleanly decoupled from HTTP server (`app.js` vs `server.js`).
  - Dual healthcheck probes: Liveness (`GET /api/v1/health/live`) and Readiness (`GET /api/v1/health/ready` with graceful drain checking).
  - Production-grade graceful shutdown handling `SIGINT`/`SIGTERM` with 10s drain window, immediate 503 health probe signaling, and connection cleanup.
  - Mongoose connection and MongoDB session store (`connect-mongo`) with `httpOnly`, `sameSite: 'lax'` cookies.
  - **Security & Session Hardening (Phase 9)**:
    - Session fixation mitigation via `req.session.regenerate()` with `req.session.authTime` recorded upon login and registration OTP verification.
    - Password change session invalidation: `passwordChangedAt` in `User` model, invalidation of all existing sessions in store, and dynamic timestamp gating in `requireAuth`.
    - Tailored Content Security Policy (Helmet) explicitly configured for Razorpay Checkout iframe (`checkout.razorpay.com`), metrics (`lumberjack.razorpay.com`), with `frame-ancestors: 'none'` and HSTS.
    - State-changing CSRF origin/referer validation on `POST`, `PUT`, `PATCH`, `DELETE` routes, with cryptographic HMAC exemption for server-to-server Razorpay webhooks.
    - Tiered rate limiters: global (300/15m), auth (10/15m), OTP (5/5m), payment operations (30/15m), webhooks (120/1m).
    - Cryptographic constant-time comparison (`crypto.timingSafeEqual`) for all signature verifications.
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
  - **Phase 6 Online Payments & Razorpay Integration**:
    - Upfront stock reservation on internal order creation (ADR-28).
    - Server-authoritative Razorpay order creation in paise (`orders.create`).
    - Cryptographic verification via HMAC SHA-256 (`crypto.timingSafeEqual`).
    - Raw-body webhook verification with event deduplication (`PaymentEvent.eventId`).
    - Payment retry preserving order line-items and address without rebuilding cart.
    - Automated reservation expiration sweeper releasing unpaid stock after 15 minutes.
  - **Phase 7 Customer Wallet, Ledger, Gateway Refunds & Hardening**:
    - **ADR-30 Architectural Separation**: Gateway refunds route to original funding source via Razorpay; customer wallet represents stored value for promotional rewards and admin adjustments. Zero cross-contamination.
    - **ADR-31 Integer Minor Units (Paise)**: Standardized all money values internally to whole paise (`validate: Number.isInteger`). Presentation conversion to rupees occurs strictly at UI boundaries.
    - **ADR-32 Refund Concurrency & Capacity Reservation**: Atomic conditional capacity reservation on `Payment.committedRefundPaise` before gateway calls. Failure safely releases capacity for retry.
    - **ADR-33 Return Lifecycle & Inspection Gate**: `DELIVERED` → `RETURN_REQUESTED` → `RETURN_APPROVED` → `RETURN_RECEIVED` → `RETURN_INSPECTED` → `RETURNED`. Stock is **never** restored upon approval; restored only after physical arrival and inspection pass (`inspectionPassed && restock`).
    - **Append-Only Wallet Ledger**: Wallet uses an immutable append-only transaction ledger with a materialized current balance. The balance consistency invariant is verified as total credits minus total debits ($\text{Wallet.balance} = \sum \text{credits} - \sum \text{debits}$).
    - **Structured Financial Audit Logging**: `auditLogger.js` logs admin actions (`ADMIN_WALLET_CREDIT`, `ADMIN_WALLET_DEBIT`, `ADMIN_INITIATED_REFUND`, `ADMIN_APPROVED_RETURN`, `ADMIN_REJECTED_RETURN`) with automatic credential and token redaction.
    - **Role-Based Security Guards**: Standard users strictly blocked (403) from refund creation, return reviews, or wallet balance manipulation.
  - **Phase 8 Admin Dashboard, Operational Reports & Portfolio Polish**:
    - **ADR-34 Operational Reporting Engine**: MongoDB aggregation pipelines aggregating gross sales, net sales, discounts, shipping fees, and refunds using native integer paise arithmetic.
    - **Pure-JS PDF Streaming (`pdfkit`)**: Direct HTTP streaming of styled executive A4 PDF reports with zero native binary dependencies or headless browser bloat.
    - **RFC 4180 CSV Export**: Complete downloadable CSV exports with header metadata, executive totals, daily sales trajectory, and top-selling product turnover.
    - **Variant-Level Inventory Matrix**: `GET /api/v1/admin/products/inventory` unwinding embedded variant SKUs, highlighting low-stock items (< 10 units), and exposing cost prices to authorized administrators.
    - **Customer Account Governance**: Searchable, paginated user registry with account suspension controls, mandatory audit reasons, and self-suspension prevention guards.
    - **Interactive Administrative Control Plane**: Partitioned React Router tree guarding `/admin/*` via `AdminRoute` and `AdminLayout`, with dedicated views for Dashboard, Reports, Inventory, Returns, Wallets, Refunds, and 12-Factor Security Audit Explorer.
  - **Phase 9 Production Optimization & Containerization**:
    - **ADR-35 Production Containerization & Defense-in-Depth**: Multi-stage Docker packaging (`node:20-alpine`, `nginx:alpine`), unprivileged user execution, container health probes.
    - **Frontend Code-Splitting**: Converted all 14 admin pages to `React.lazy()` dynamic imports, reducing main customer bundle from 645 kB to **490.63 kB** (144.60 kB gzip) and eliminating bundle size warnings.
    - **Database Index Optimization**: Compound indexes added on `Order ({ createdAt: -1, orderStatus: 1 })` and `Refund ({ status: 1, createdAt: -1 })`.
    - **End-to-End Test Suite**: Complete 17-scenario verification (`backend/tests/e2e.test.js`) passing 100%.
  - **Phase 10 AWS Production Deployment & Cloud Architecture**:
    - **ADR-36 Cloud Architecture Selection**: EC2 with Docker Compose (`t3.small` / `t4g.small`), MongoDB Atlas managed database, AWS S3 for media storage, AWS SES for transactional emails, Route 53 DNS, Certbot SSL/TLS.
    - **Health-Checked Deployment Pipeline**: Scripted deployment pipeline via `scripts/deploy.sh` with readiness probe gating and rollback support.
    - **S3 & SES Integration**: `@aws-sdk/client-s3` presigned URL generation and `@aws-sdk/client-ses` dispatch with safe test-mode fallbacks.
    - **Browser E2E Suite**: Playwright browser smoke testing configuration (`playwright.config.js`) and UI test suite (`smoke.spec.js`) verified (3/3 passed).
  - Automated integration test suite using **Vitest** and **Supertest** passing **205/205 tests across 18 test files (100%)**.
  - Verified frontend production build compiling cleanly with zero warnings.

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
| **Phase 6** | Razorpay Payments & Webhooks | **Completed** | [phase-06-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-06-report.md) |
| **Phase 7** | Wallet, Ledger, Refunds & Hardening | **Completed** | [phase-07-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-07-report.md) |
| **Phase 8** | Admin Operations, Reports, Export & Polish | **Completed** | [phase-08-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-08-report.md) |
| **Phase 9** | Security Audit, Performance, E2E & Containerization | **Completed** | [phase-09-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-09-report.md) / [phase-09-security-audit.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-09-security-audit.md) |
| **Phase 10**| AWS Production Deployment & Cloud Architecture | **Implementation complete; cloud & container verification pending** | [phase-10-report.md](file:///c:/Users/vines/react%20first%20project/docs/reports/phase-10-report.md) |

---

## 4. Phase 10 Final Verification Breakdown

### Verified
- **Backend Test Suite (`npm test`)**: Passed **205/205 tests across 18 test files (100%)**.
  - `tests/health.test.js`: 4 tests passed.
  - `tests/concurrency.test.js`: 4 tests passed.
  - `tests/wishlist.test.js`: 8 tests passed.
  - `tests/checkout.test.js`: 4 tests passed.
  - `tests/cart.test.js`: 14 tests passed.
  - `tests/category.test.js`: 6 tests passed.
  - `tests/coupon.test.js`: 9 tests passed.
  - `tests/brand.test.js`: 5 tests passed.
  - `tests/offer.test.js`: 6 tests passed.
  - `tests/address.test.js`: 14 tests passed.
  - `tests/adminReports.test.js`: 17 tests passed.
  - `tests/product.test.js`: 22 tests passed.
  - `tests/payment.test.js`: 17 tests passed.
  - `tests/wallet.test.js`: 14 tests passed.
  - `tests/refund.test.js`: 11 tests passed.
  - `tests/order.test.js`: 11 tests passed.
  - `tests/auth.test.js`: 22 tests passed.
  - `tests/e2e.test.js`: 17 tests passed (API-level integration tests).
- **Frontend Production Build (`npm run build`)**: Compiled cleanly in 7.95s with zero warnings (client bundle: 496.02 kB).
- **Playwright Browser Tests (`npx playwright test`)**: Passed **6/6 smoke tests (100%)** across Chromium testing Homepage layout/branding, Catalog search & filter controls, Authentication form visibility, Client-side field-level Zod validation on empty submission, and Authenticated login session redirection.
- **Deployment Scripts & Manifests**: `scripts/setup-ec2.sh`, `scripts/deploy.sh`, `scripts/health-check.sh`, `docker-compose.prod.yml` prepared.

### Not Executed
- **Docker Compose Runtime Verification**: `docker compose -f docker-compose.prod.yml config` and local image builds could not be executed locally because Docker CLI is not installed on this host.

### Requires AWS
- **EC2 Instance Provisioning**: Ubuntu host creation, SSH access, firewall configuration.
- **Route 53 & Let's Encrypt**: Domain mapping and TLS certificate issuance on port 443.
- **MongoDB Atlas Production Connection**: Whitelisting Elastic IP and connecting via TLS replica set URI.
- **AWS S3 Live Integration**: Real bucket provisioning, presigned URL direct uploads, and multipart upload endpoints.
- **AWS SES Live Delivery**: Domain verification and real inbox email delivery.
- **Razorpay Production Webhooks**: Live gateway callbacks delivered over the public internet.


