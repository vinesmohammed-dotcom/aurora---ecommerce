# 01 — System Requirements & Feature Analysis

## 1. Overview
This document provides the exhaustive requirements breakdown for the full-stack MERN e-commerce application. Requirements are categorized using the industry-standard MoSCoW framework (**Must Have**, **Should Have**, **Could Have**, **Later**) along with clear ownership, dependencies, and implementation complexity ratings.

---

## 2. Core Features (Must Have — MVP)
Features strictly required for the application to function end-to-end as a viable commercial store.

| Feature | Purpose | Who Uses It | Dependencies | Priority | Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User Registration & Email OTP** | Verifies legitimate customer email identities before account activation; prevents spam/bot accounts. | Customer | Node.js, Express, MongoDB, AWS SES / Nodemailer | Must Have | Medium |
| **Secure Login & Session Management** | Authenticates users; issues `httpOnly`, `secure`, `sameSite: lax` cookies backed by MongoDB session store. | Customer, Admin | `express-session`, `connect-mongo`, bcrypt | Must Have | Medium |
| **Role-Based Authorization (RBAC)** | Protects endpoints and views; restricts admin routes from customer access. | Customer, Admin | Express Middleware, User Model (`role: 'USER' \| 'ADMIN'`) | Must Have | Low |
| **Product Catalog & Variant Display** | Shows active products, images, categories, brands, and variant choices (size, color, price, stock). | Customer, Public | Product Model, Category Model, Brand Model | Must Have | Medium |
| **Catalog Search, Filter & Pagination** | Allows fast product discovery by keyword, category, price range, brand, and sorting with server-side pagination. | Customer, Public | MongoDB Compound Indexes, Express Query Parser | Must Have | Medium |
| **Cart Management** | Allows adding variants, modifying quantities, removing items; validates server-side price and stock. | Customer | Cart Model, Product Model, Session Middleware | Must Have | Medium |
| **Address Management** | Create, view, edit, delete, and set default multi-line shipping addresses. | Customer | User / Address Model | Must Have | Low |
| **Multi-Stage Checkout Engine** | Validates item availability, recalculates total from database, reserves order. | Customer | Cart, Product, Address, Order Service | Must Have | High |
| **Razorpay Payment Integration** | Generates Razorpay orders, opens checkout modal, verifies HMAC-SHA256 signature server-side. | Customer | Razorpay SDK, Order Model, Payment Model | Must Have | High |
| **Order Creation & Snapshotting** | Freezes immutable snapshot of product title, SKU, variant, price, and address at time of purchase. | Customer, System | Order Model, Checkout Service, DB Transaction | Must Have | High |
| **Order History & Detail View** | Displays list of previous orders, itemized summary, tracking status, and delivery address. | Customer | Order Model, Auth Middleware | Must Have | Low |
| **Order Cancellation** | Permits cancelling orders in `CONFIRMED` or `PROCESSING` state; triggers automatic refund/wallet credit. | Customer, Admin | Order Service, Wallet Service, Stock Restorer | Must Have | Medium |
| **Admin Dashboard & Metrics** | High-level overview of total sales, total orders, active users, and low-stock alerts. | Admin | Order Model, Product Model, User Model | Must Have | Medium |
| **Admin Catalog CRUD** | Add/edit products, manage variant stocks, upload images, enable/disable listings. | Admin | Product Model, S3 Service / Multer | Must Have | High |
| **Admin Order Management** | Review all platform orders, transition order lifecycle states (`PROCESSING` → `SHIPPED` → `DELIVERED`). | Admin | Order Model, Audit Service | Must Have | Medium |

---

## 3. Secondary Features (Should Have — Post-MVP v1.1)
Features that elevate the product from basic functional status to a polished, competitive store.

| Feature | Purpose | Who Uses It | Dependencies | Priority | Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User Wallet & Ledger** | Stored value balance for fast checkout and frictionless instant refunds on cancellation/returns. | Customer | Wallet Model, WalletTransaction Model | Should Have | High |
| **Coupon Code System** | Promotional code entry at checkout with rules: min order value, max discount cap, expiry, usage count. | Customer, Admin | Coupon Model, Checkout Calculation Engine | Should Have | High |
| **Category & Product Offers** | Automatic catalog-wide or category-wide percentage discounts displayed directly on product cards. | Customer, Admin | Offer Model, Product Aggregation Pipeline | Should Have | High |
| **Customer Wishlist** | Save favorite items for later viewing and quick moving into active cart. | Customer | Wishlist Model, Product Model | Should Have | Low |
| **Payment Retry Engine** | If online payment fails or modal is closed, order remains `PAYMENT_FAILED` allowing the user to re-attempt payment without re-adding items. | Customer | Payment Service, Razorpay API | Should Have | High |
| **Product Return Workflow** | Customer can request return within 7 days of delivery; admin approves/rejects; refund credited upon receipt. | Customer, Admin | Order State Machine, Wallet Service | Should Have | Medium |
| **Automated PDF Invoice** | Generates downloadable, professional PDF tax invoice with GST breakdown and order snapshot. | Customer, Admin | PDFKit / Puppeteer, S3 Service | Should Have | Medium |
| **Admin Sales Reports** | Filter revenue, discounts, and order metrics by date range (daily, weekly, custom) with PDF & CSV export. | Admin | MongoDB Aggregation, Fast-CSV, PDFKit | Should Have | High |
| **Password Reset via Email Link/OTP** | Self-service password recovery flow using secure time-limited tokens. | Customer | Token / OTP Model, AWS SES | Should Have | Medium |

---

## 4. Optional Improvements (Could Have — Phase 2)
High-polish features that add impressive technical depth for portfolio demonstration.

| Feature | Purpose | Who Uses It | Dependencies | Priority | Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Customer Product Reviews & Ratings** | Verified buyers can leave 1–5 star reviews and photo feedback. | Customer | Review Model, Order Verification | Could Have | Medium |
| **Live Webhook Reconciler** | Background worker verifying missed Razorpay webhooks directly against Razorpay REST API. | System | Razorpay API, Node Scheduler | Could Have | High |
| **Social Login (Google OAuth 2.0)** | One-click login using Google identity provider. | Customer | Passport.js / Google Auth Library | Could Have | Medium |
| **Stock Scarcity Warnings** | Dynamic "Only 2 left in stock!" badges to encourage conversion. | Customer | Frontend Variant State, Product Model | Could Have | Low |
| **Audit Logs for Admin Actions** | Immutable record of which admin changed prices, cancelled orders, or modified user statuses. | Admin, Auditor | AuditLog Model, Express Middleware | Could Have | Medium |

---

## 5. Summary Priority Matrix
- **Must Have (15 features)**: Essential customer storefront, cart, atomic checkout, Razorpay payments, admin catalog CRUD, and order lifecycle.
- **Should Have (9 features)**: Wallet ledger, coupons, category offers, payment retry, return requests, sales PDF/CSV exports.
- **Could Have (5 features)**: Reviews, audit logging, Google OAuth, live webhook polling.
- **Later**: Deferred to Phase 2 (see [28-future-improvements.md](file:///c:/Users/vines/react%20first%20project/docs/28-future-improvements.md)).
