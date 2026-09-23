# Aurora E-Commerce — Enterprise Modular Monolith Platform

A production-grade, highly scalable full-stack e-commerce engine engineered with the **MERN** stack (MongoDB 7, Express 5, React 19, Node.js 20) and Vite 8. Designed as a flagship enterprise software project demonstrating strict modular monolith architecture, minor-unit financial integrity, atomic concurrency controls, PCI-compliant payment orchestration, and production Docker containerization.

---

## Highlights & System Capabilities

- **Integer Minor-Unit Financial Engineering**: Zero floating-point arithmetic. All monetary values across orders, payments, coupons, offers, and wallet transactions are processed strictly in integer **paise** (₹1 = 100 paise; ₹1,000 = 100,000 paise).
- **PCI-Compliant Razorpay Integration**: Server-authoritative order generation, cryptographic HMAC SHA-256 verification via constant-time comparisons (`crypto.timingSafeEqual`), raw-body webhook signature verification, and automated 15-minute stock reservation expiration sweepers.
- **Append-Only Wallet Ledger**: Customer wallets powered by an immutable transaction ledger with verified balance invariant tracking ($\text{Wallet.balance} = \sum \text{credits} - \sum \text{debits}$). Zero cross-contamination between wallet balances and external gateway refunds.
- **Atomic Concurrency Protection**: High-throughput stock decrement utilizing atomic MongoDB conditional operators (`$elemMatch` on `variants.stock >= quantity` and `$inc: { "variants.$.stock": -quantity }`), preventing overselling under heavy concurrency.
- **Multi-Stage RMA & Return Pipeline**: Strict return governance gate (`DELIVERED` → `RETURN_REQUESTED` → `RETURN_APPROVED` → `RETURN_RECEIVED` → `RETURN_INSPECTED` → `RETURNED`). Inventory is restored exclusively after physical warehouse receipt and passed quality inspection.
- **Pure-JS Executive Reports & Streaming PDF**: Native MongoDB aggregation pipelines generating real-time sales analytics. Zero-native-binary PDF generation via pure Node.js `pdfkit` streaming directly to HTTP responses, eliminating heavy headless browser bloat.
- **Defense-in-Depth Security**: Session fixation defense via `req.session.regenerate()`, session invalidation on password change (`passwordChangedAt`), tailored Helmet Content Security Policy for Razorpay iframes, CSRF origin/referer verification on state-changing requests, and tiered rate limiters.
- **Optimized Frontend Performance**: Converted all 14 admin pages into `React.lazy()` dynamic imports, compressing the client-facing bundle to **490.63 kB** (144.60 kB gzip) and eliminating bundle size warnings.
- **Production Containerization**: Multi-stage `Dockerfile` (`node:20-alpine`, `nginx:alpine`) running under unprivileged user permissions, automated container health probes, 10-second graceful shutdown draining, and `docker-compose.yml`.

---

## Architecture Overview

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │                Client Web Browser                      │
                                    └───────────────────────────┬────────────────────────────┘
                                                                │
                                              Port 3000 / HTTP (Nginx Container)
                                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ aurora-frontend: Nginx Reverse Proxy & Static Asset Engine                                                            │
│ ├── Immutable Cache Headers (/assets/*)                                                                                │
│ ├── Single Page Application Fallback (try_files $uri $uri/ /index.html)                                                │
│ └── /api/ Upstream Proxy Pass ──────────────────────────────────────────┐                                              │
└─────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┘
                                                                          │ (Internal Network: aurora-backend:5000)
                                                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ aurora-backend: Node.js 20 Alpine (Express 5 REST API)                                                                 │
│ ├── Security Layer: Helmet CSP, CSRF Origin Verifier, Tiered Rate Limiters, connect-mongo Sessions                     │
│ ├── Auth & Governance: Session Fixation Guard, Password Change Session Invalidation, Role Authorization               │
│ ├── Catalog & Inventory: Variant Matrix, Text Search, Low-Stock Tracking, Wholesale Cost-Price Isolation               │
│ ├── Cart & Concurrency: Live Stock Validation, Atomic Concurrency Service ($elemMatch + $inc)                          │
│ ├── Authoritative Checkout: Deterministic Non-Stacking Offers, Capped Coupons, Dynamic Tiered Shipping                 │
│ ├── Payment Engine: Razorpay Orders & Webhooks, HMAC Timing-Safe Signatures, 15m Expiration Sweeper                    │
│ ├── Financial Engine: Integer Minor Units (Paise), Capacity-Reserved Refunds, Append-Only Wallet Ledger               │
│ ├── Returns Engine: Multi-Step RMA Lifecycle, Quality Inspection Gate, Controlled Restocking                           │
│ └── Reporting & Analytics: MongoDB Minor-Unit Aggregations, Pure-JS Streaming PDFKit Reports, RFC 4180 CSV Exports     │
└─────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                                          │ (Internal Network: aurora-mongo:27017)
                                                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ aurora-mongo: MongoDB 7.0 Database Container                                                                           │
│ ├── Collections: users, sessions, categories, brands, products, addresses, carts, wishlists, orders,                  │
│ │                payments, paymentevents, refunds, wallets, wallettransactions                                        │
│ └── Optimized Indexing: Compound { createdAt: -1, orderStatus: 1 }, { status: 1, createdAt: -1 }, Text Indexes        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7, Redux Toolkit, Lucide React, Axios, Vanilla Modern CSS |
| **Backend** | Node.js 20 LTS, Express 5, Mongoose 8, Helmet, CORS, Express-Rate-Limit, Connect-Mongo, PDFKit, Zod |
| **Database** | MongoDB 7.0 (with compound indexes, TTL sessions, and atomic array operations) |
| **Payments** | Razorpay Node.js SDK, HMAC-SHA256 signature verification, Webhook idempotency |
| **Testing** | Vitest 3, Supertest (18 test suites, 204 automated tests, 17-scenario E2E test suite) |
| **DevOps & Containers** | Docker, Docker Compose, Multi-stage builds, Nginx Alpine, Alpine Linux, PM2 ready |

---

## Directory Structure

```
project-root/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment validation & DB connection
│   │   ├── constants/       # HTTP status codes & business constants
│   │   ├── middlewares/     # Auth, session gating, CSRF check, rate limiting, error handling
│   │   ├── modules/         # Feature-based domain modules
│   │   │   ├── addresses/   # Customer delivery addresses (partial filter default index)
│   │   │   ├── auth/        # Login, signup, HMAC-OTP, session regeneration
│   │   │   ├── brands/      # Catalog brands
│   │   │   ├── cart/        # Catalog-reconciled shopping cart
│   │   │   ├── categories/  # Hierarchical categories
│   │   │   ├── checkout/    # Authoritative calculation engine (offers, coupons, shipping)
│   │   │   ├── coupons/     # Promotional coupons with redemption quotas
│   │   │   ├── health/      # Liveness and readiness probes with graceful shutdown drain
│   │   │   ├── offers/      # Category/product percentage offers (highest wins)
│   │   │   ├── orders/      # Orders, atomic stock decrements, return workflow
│   │   │   ├── payments/    # Razorpay orders, webhooks, signature verification, expiration sweeper
│   │   │   ├── products/    # Products & embedded variants, cost-price protection, inventory matrix
│   │   │   ├── refunds/     # Gateway refunds with atomic capacity reservation
│   │   │   ├── reports/     # Native aggregation sales analytics, PDFKit streaming, CSV generator
│   │   │   ├── users/       # Profile management, password updates, admin governance
│   │   │   ├── wallet/      # Customer wallet & append-only transaction ledger
│   │   │   └── wishlist/    # Wishlist management
│   │   ├── routes/          # Versioned REST router (/api/v1)
│   │   ├── utils/           # ApiResponse, ApiError, asyncHandler, 12-factor auditLogger
│   │   ├── app.js           # Decoupled Express app
│   │   └── server.js        # Server boot, DB connection & 10s graceful shutdown handler
│   ├── tests/               # 18 Vitest integration & E2E test files
│   ├── Dockerfile           # Multi-stage production container for backend
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Router setup with lazy-loaded admin routes
│   │   ├── components/      # Common navigation, footer, guards (AdminRoute, ProtectedRoute)
│   │   ├── features/        # Feature slices (cart, checkout, catalog, auth)
│   │   ├── layouts/         # MainLayout, AdminLayout (with React.Suspense)
│   │   ├── pages/           # Customer pages & 14 lazy-loaded Admin pages
│   │   ├── services/        # Axios API client
│   │   └── store/           # Redux Toolkit store & slices
│   ├── Dockerfile           # Multi-stage build (Vite + Nginx)
│   ├── nginx.conf           # Production Nginx reverse-proxy & caching configuration
│   └── package.json
├── docs/                    # 30+ Architectural decision records, security specs, milestone reports
├── docker-compose.yml       # Production orchestration (MongoDB + Backend + Frontend)
├── .dockerignore
├── PROJECT_STATUS.md        # Master phase tracking board
└── README.md
```

---

## Verification & Test Results

The platform enforces 100% test coverage across critical user flows and security invariants:

```bash
cd backend
npm test
```

### Test Suite Execution Output:
```
 Test Files  18 passed (18)
      Tests  204 passed (204)
   Duration  73.69s

 ✓ tests/address.test.js (14 tests)
 ✓ tests/adminReports.test.js (17 tests)
 ✓ tests/auth.test.js (22 tests)
 ✓ tests/brand.test.js (5 tests)
 ✓ tests/cart.test.js (14 tests)
 ✓ tests/category.test.js (6 tests)
 ✓ tests/checkout.test.js (4 tests)
 ✓ tests/concurrency.test.js (4 tests)
 ✓ tests/coupon.test.js (9 tests)
 ✓ tests/e2e.test.js (17 tests)
 ✓ tests/health.test.js (3 tests)
 ✓ tests/offer.test.js (6 tests)
 ✓ tests/order.test.js (11 tests)
 ✓ tests/payment.test.js (17 tests)
 ✓ tests/product.test.js (22 tests)
 ✓ tests/refund.test.js (11 tests)
 ✓ tests/wallet.test.js (14 tests)
 ✓ tests/wishlist.test.js (8 tests)
```

---

## Running the Platform

### Option A: Running with Docker Compose (Recommended)

1. Clone repository and configure environment:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
2. Build and launch all containers:
   ```bash
   docker compose up --build -d
   ```
3. Access services:
   - **Frontend**: `http://localhost:3000`
   - **Backend API**: `http://localhost:5000/api/v1`
   - **Liveness Probe**: `http://localhost:5000/api/v1/health/live`
   - **Readiness Probe**: `http://localhost:5000/api/v1/health/ready`

### Option C: AWS Production Deployment (Prepared Deployment Procedure)

> **Deployment Status**: The project includes production-oriented Docker and AWS deployment configuration. The AWS environment has not yet been provisioned.

#### 1. Provision Ubuntu 24.04 LTS Host
Connect to your EC2 instance and execute the host bootstrapping script:
```bash
git clone https://github.com/your-username/aurora-ecommerce.git /opt/aurora-ecommerce
cd /opt/aurora-ecommerce
sudo bash scripts/setup-ec2.sh
```

#### 2. Configure Production Secrets
Create `.env.production` with your live credentials:
```bash
cp backend/.env.example .env.production
nano .env.production
```
Configure:
- `MONGODB_URI`: MongoDB Atlas connection string (`mongodb+srv://...`).
- `SESSION_SECRET`: Cryptographic random string (minimum 32 characters).
- `FRONTEND_URL`: Production domain (`https://store.yourdomain.com`).
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Razorpay live or test API keys.

#### 3. Execute Health-Checked Deployment
```bash
chmod +x scripts/*.sh
./scripts/deploy.sh
```

#### 4. Verify Health & Smoke Test
```bash
./scripts/health-check.sh store.yourdomain.com
```

---

## Milestone Roadmap & Delivery

- [x] **Phase 0**: Requirements, Technical Architecture & Blueprint
- [x] **Phase 1**: Modular Monolith Scaffolding & Foundation
- [x] **Phase 2**: Customer Authentication & Session Management
- [x] **Phase 3**: Product Catalog, Multi-Variant Matrix & Text Search
- [x] **Phase 4**: Shopping Cart, Wishlist & Concurrency Controls
- [x] **Phase 5**: Authoritative Checkout, Coupons, Offers & Orders
- [x] **Phase 6**: Razorpay Gateway, HMAC Signatures & Expiration Sweeper
- [x] **Phase 7**: Customer Wallet, Append-Only Ledger, Refunds & Hardening
- [x] **Phase 8**: Admin Control Plane, Analytics Aggregations, PDF & CSV Exports
- [x] **Phase 9**: Security Audit, Performance Profiling, E2E Verification & Dockerization
- [x] **Phase 10**: AWS Production Deployment & Cloud Architecture (Implementation complete; AWS deployment not yet executed)

