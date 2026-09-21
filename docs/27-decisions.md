# 27 — Architectural Decision Records (ADRs) & Technology Trade-Offs

## 1. Decision Framework
Every technical choice in this project follows a rigorous 5-point architectural evaluation:
1. **Why we need it**
2. **What problem it solves**
3. **Why it is appropriate for this project**
4. **What simpler alternative exists**
5. **Why we are or are not choosing that alternative**

---

## 2. Architectural Decision Records (ADRs)

### ADR-01: React (Vite) as Frontend Framework
- **Why we need it**: A modern, reactive user interface for interactive catalog filtering, live cart drawers, and administrative dashboards.
- **Problem it solves**: Eliminates manual DOM manipulation, spaghetti event listeners, and full-page refreshes.
- **Why appropriate**: React is the most widely adopted frontend library in modern enterprise software, maximizing portfolio employability. Vite provides instantaneous ESM-based Hot Module Replacement (HMR).
- **Simpler alternative**: Plain Vanilla HTML/JavaScript or Multi-Page Application (MPA) rendered with EJS/Pug.
- **Why alternative rejected**: Server-rendered EJS templates cannot deliver seamless single-page checkout flows or rich interactive dashboards without writing brittle custom JavaScript. Next.js was evaluated but rejected to avoid server-side rendering (SSR) hydration complexity for a first portfolio project.

### ADR-02: Redux Toolkit for Global Client State
- **Why we need it**: Centralized state management for authenticated user status, cart item count badges, and global UI alerts.
- **Problem it solves**: Eliminates "prop drilling" (passing data through 5 intermediate component layers) and manages cross-cutting state predictably.
- **Why appropriate**: Redux Toolkit (RTK) eliminates legacy Redux boilerplate while integrating seamlessly with Redux DevTools.
- **Simpler alternative**: React Context API.
- **Why alternative rejected**: React Context triggers full re-renders of all consuming components whenever any value in the context object changes. RTK provides selector-level memoization (`useSelector`), optimizing rendering performance.

### ADR-03: Express.js & Node.js Runtime
- **Why we need it**: Asynchronous, non-blocking HTTP server environment for building our REST API.
- **Problem it solves**: High concurrency handling for I/O-heavy operations (database queries, network requests) on a single thread.
- **Why appropriate**: Enables full-stack JavaScript, sharing data structures, mental models, and validation rules across client and server.
- **Simpler alternative**: Python Flask / FastAPI or Ruby on Rails.
- **Why alternative rejected**: Introducing a second language increases cognitive load and context switching for a junior developer.

### ADR-04: Service Layer atop Express MVC
- **Why we need it**: Enforces a strict separation of concerns between HTTP routing/controllers and domain business rules.
- **Problem it solves**: Prevents "fat controllers" where database queries, discount math, payment calls, and HTTP responses are tangled in one massive file.
- **Why appropriate**: Mirrors enterprise architectural standards, making services easily unit-testable without mocking HTTP request/response objects.
- **Simpler alternative**: Pure two-layer Controller-Model structure.
- **Why alternative rejected**: Two-layer MVC degrades into unmaintainable spaghetti code as business rules (coupons, wallet, inventory checks) become complex.

### ADR-05: MongoDB with Mongoose ODM
- **Why we need it**: Document database providing flexible JSON-like storage for products, variants, and frozen order snapshots.
- **Problem it solves**: Relational SQL tables require complex migration scripts and normalized multi-table joins (`products`, `variants`, `attributes`, `images`) for varying catalog attributes.
- **Why appropriate**: Naturally supports embedding variants and preserving historical order snapshots as nested subdocuments without joins.
- **Simpler alternative**: SQLite or PostgreSQL.
- **Why alternative rejected**: Rigid relational schemas make managing dynamic product variants (e.g. clothing vs electronics) cumbersome for beginners without advanced EAV (Entity-Attribute-Value) patterns.

### ADR-06: Session-Based Authentication with `connect-mongo`
- **Why we need it**: Verifies user identity and protects administrative and customer endpoints.
- **Problem it solves**: Stateless JWTs stored in `localStorage` are vulnerable to XSS theft and cannot be revoked server-side on demand.
- **Why appropriate**: Grants the server 100% control to revoke sessions immediately (e.g. when an admin blocks a user or user logs out), while storing sessions in MongoDB avoids the operational cost of running a separate Redis instance.
- **Simpler alternative**: Stateless JWT in `localStorage`.
- **Why alternative rejected**: Security vulnerability (XSS exfiltration) and inability to invalidate compromised tokens immediately make JWTs inappropriate for serious commercial applications.

### ADR-07: Razorpay Payment Gateway
- **Why we need it**: Processes credit cards, debit cards, UPI, and net banking transactions securely.
- **Problem it solves**: Eliminates PCI-DSS compliance burdens; handles sensitive banking data externally.
- **Why appropriate**: Native Indian currency (INR) support, frictionless sandbox testing, and reliable HMAC webhook verification.
- **Simpler alternative**: Cash on Delivery (COD) only.
- **Why alternative rejected**: Pure COD does not showcase online payment integration skills to prospective employers.

### ADR-08: AWS S3 & AWS SES
- **Why we need it**: S3 stores media files and invoices; SES delivers transactional emails (OTPs, notifications).
- **Problem it solves**: Storing uploads on local EC2 storage exhausts disk space and fails when scaling horizontally; Gmail SMTP blocks server IPs and has strict daily sending caps.
- **Why appropriate**: Industry standard cloud primitives that demonstrate genuine AWS competence to interviewers.
- **Simpler alternative**: Local disk storage (`/public/uploads`) and Gmail SMTP.
- **Why alternative rejected**: Local disk storage breaks on server reboots or multi-instance deployments; Gmail SMTP is not production-viable.

### ADR-09: Single AWS EC2 Instance with Nginx & PM2
- **Why we need it**: Production hosting environment for frontend static assets and backend API daemon.
- **Problem it solves**: Heroku/Render free tiers sleep on inactivity, introduce severe cold starts, and hide real server administration.
- **Why appropriate**: Demonstrates real Linux systems administration, SSL termination (Let's Encrypt), reverse proxy routing, and process clustering.
- **Simpler alternative**: PaaS hosting (Vercel + Render).
- **Why alternative rejected**: PaaS hosting conceals fundamental infrastructure skills (Nginx, security groups, process daemons) that interviewers actively look for.

### ADR-10: Decoupling Express App (`app.js`) from Server Listener (`server.js`)
- **Why we need it**: Clean separation between application configuration (middlewares, routes, error handlers) and runtime network binding (port listener, database connection).
- **Problem it solves**: Calling `app.listen()` inside the same file that creates the Express app forces integration test runners (like Supertest) to bind to actual network ports, causing EADDRINUSE collisions during parallel test runs and preventing in-memory testing.
- **Why appropriate**: Standard industry practice for clean testability; allows importing `app` directly into Vitest/Supertest without booting live databases or HTTP servers.
- **Simpler alternative**: Single `server.js` containing both `app` creation and `app.listen()`.
- **Why alternative rejected**: Breaks automated integration testing and makes graceful shutdown management coupled to routing.

### ADR-11: Upgrade to Express 5 for Native Async Handling
- **Why we need it**: Modern Node.js standard for building robust web servers.
- **Problem it solves**: Express 4 required wrapping every asynchronous controller handler in custom try/catch blocks or helper functions like `asyncHandler(fn)` to prevent unhandled promise rejections from crashing the process.
- **Why appropriate**: Express 5 natively handles rejected promises in route handlers, passing them automatically to the global error middleware. It also aligns with current Node 20+ LTS runtimes.
- **Simpler alternative**: Remaining on Express 4.x.
- **Why alternative rejected**: Express 4 is legacy software. Starting a new commercial portfolio project in 2026 on Express 4 creates immediate technical debt.

### ADR-12: `bcryptjs` with 12 Salt Rounds for Password Hashing
- **Why we need it**: Irreversible cryptographic hashing of user passwords before persistence in MongoDB.
- **Problem it solves**: Plaintext or weakly hashed (MD5/SHA1) passwords lead to catastrophic credential exposure if the database is dumped.
- **Why appropriate**: `bcryptjs` is written in pure JavaScript, eliminating Python and C++ compilation toolchain requirements on Windows development machines while providing identical security output. Cost factor 12 provides strong defense against GPU-accelerated brute-force attacks (~250ms hashing time) while maintaining responsive UX.
- **Simpler alternative**: Native `crypto.pbkdf2` or `bcrypt` (C++ bindings).
- **Why alternative rejected**: Native `bcrypt` requires node-gyp and native build tools on developer machines which frequently break across OS platforms. `bcryptjs` guarantees frictionless cross-platform portability.

### ADR-13: Server-Secret Keyed HMAC-SHA256 Hashed OTPs with MongoDB TTL Index
- **Why we need it**: Ephemeral verification tokens for user registration, password resets, and email changes.
- **Problem it solves**: 6-digit numeric OTPs possess an entropy space of only $10^6$ (1,000,000 values). A standard unkeyed hash (e.g. SHA-256) can be cracked in less than a second using a precomputed lookup table if the database is breached. Leaving expired OTPs causes unbounded storage growth.
- **Why appropriate**: Server-secret keyed `crypto.createHmac("sha256", env.OTP_SECRET).update(`${otp}:${purpose}:${email}`).digest("hex")` cryptographically binds the token to both the recipient and intention, making offline precomputation impossible without the server secret. Verification uses `crypto.timingSafeEqual` to eliminate timing side-channels. A MongoDB TTL index (`{ expiresAt: 1 }, { expireAfterSeconds: 0 }`) guarantees that the database engine automatically purges expired tokens every 60 seconds without background cron daemons.
- **Simpler alternative**: Plaintext OTP in the `users` document or plain unsalted SHA-256.
- **Why alternative rejected**: Plaintext storage creates severe credential leakage risks; plain SHA-256 is vulnerable to offline rainbow table brute-force on 6-digit codes.

### ADR-14: Repository Layer Usage Boundary
- **Why we need it**: Clear separation of persistence logic while avoiding redundant, anemic abstraction layers.
- **Problem it solves**: Dogmatic implementations of the Repository Pattern often create empty "pass-through" wrapper classes that merely call `Model.findById(id)` without adding query logic, adding boilerplate without benefit.
- **Why appropriate**: We establish a strict architectural boundary: controllers delegate to services. Services interact with Mongoose models directly for standard CRUD operations. Separate repository modules are introduced **only** when complex query encapsulation, multi-collection aggregation pipelines, or data-source swapping is genuinely required.
- **Simpler alternative**: Creating strict Repository wrappers for every single Mongoose model.
- **Why alternative rejected**: Violates the "Do not over-engineer" principle. Mongoose `Model` is already an Active Record / Repository pattern implementation. Adding pure pass-through wrappers introduces maintenance overhead with zero operational benefit.

### ADR-15: Embedded Variants Array within Product Document
- **Why we need it**: High-performance catalog queries and atomic inventory management.
- **Problem it solves**: A separate relational `variants` collection requires expensive `$lookup` (JOIN) stages on every storefront catalog and product detail query, increasing database latency.
- **Why appropriate**: Products and their physical variants (sizes, colors, SKUs) are read together 99% of the time. Embedding variants in `Product.variants: [variantSchema]` provides zero-JOIN single-query reads and enables atomic inventory decrements (`$inc: { "variants.$.stock": -qty }`) using MongoDB's document-level ACID guarantees.
- **Simpler alternative**: Normalizing variants into a separate MongoDB collection with `productId` references.
- **Why alternative rejected**: Requires multi-stage aggregations and multi-document ACID transactions across collections for routine stock decrements, introducing unnecessary locking overhead.

### ADR-16: Wholesale Cost Price Concealment via Projection
- **Why we need it**: Wholesale margin confidentiality.
- **Problem it solves**: Accidental leakage of wholesale supplier costs (`costPrice`) to storefront visitors, competitors, or crawlers.
- **Why appropriate**: Strict field projection at the database layer using `.select('-variants.costPrice')` in all public catalog service queries (`getPublicProducts` and `getPublicProductBySlug`). The controller and service guarantee that public endpoints never transmit margin information over the wire, while administrative endpoints (`/admin/products/all` and `/admin/products/:id`) retain full margin metrics for authorized business personnel.
- **Simpler alternative**: Stripping `costPrice` in frontend React UI code.
- **Why alternative rejected**: Filtering on the frontend is a critical security vulnerability: inspecting the browser Network tab immediately exposes the wholesale margins sent in the JSON HTTP response.

### ADR-17: Test Parallelism Isolation for Single-Instance MongoDB
- **Why we need it**: Deterministic, flake-free automated integration testing.
- **Problem it solves**: By default, Vitest executes test files concurrently. When integration tests run against a single shared MongoDB database, teardown hooks (`afterAll(() => Category.deleteMany({}))`) in one test suite delete documents that are actively being queried by another concurrent test suite, causing spurious race conditions.
- **Why appropriate**: Configuring `fileParallelism: false` in `vitest.config.js` ensures test suites run sequentially, guaranteeing full database consistency across category, brand, product, and authentication test runs without requiring multi-tenant container orchestration.
- **Simpler alternative**: Randomizing database names per test worker.
- **Why alternative rejected**: Spawning multiple isolated databases on local development machines increases RAM consumption and startup latency for minimal gain.

### ADR-18: Vite 8 Upgrade for Modern Frontend Build Toolchain
- **Why we need it**: State-of-the-art frontend bundler and dev server compatible with React 19.
- **Problem it solves**: Legacy Vite builds produced deprecation warnings for modern Node ESM environments (`__dirname` replacement with `import.meta.dirname`).
- **Why appropriate**: Vite 8.3.0 provides instant HMR, ES module native handling, and compiles our production bundle in ~2 seconds.
- **Simpler alternative**: Remaining on older Vite versions.
- **Why alternative rejected**: Outdated bundlers carry security advisories and lack optimizations for modern React 19 hooks and transitions.

### ADR-19: Dual-Level SKU Uniqueness Protection for Embedded Variants
- **Why we need it**: Strict guarantee that no two variants in the catalog share an SKU.
- **Problem it solves**: MongoDB unique multikey indexes on array fields (e.g. `variants.sku`) prevent duplicate values across *different* documents, but do NOT prevent duplicate values within the *same* document array.
- **Why appropriate**: Dual-level protection: database-level unique sparse index across product documents + application-level validation checking for intra-document duplicates during product creation, variant addition, and variant modification.
- **Simpler alternative**: Relying solely on the database multikey index.
- **Why alternative rejected**: Fails silently when two identical SKUs are inserted into the same product's variant array.

### ADR-20: Dynamic Ephemeral Pricing for Shopping Cart
- **Why we need it**: Real-time pricing accuracy and protection against price tampering.
- **Problem it solves**: If prices are written into the Cart document, admin price changes cause catalog drift, and malicious clients could submit modified prices.
- **Why appropriate**: Cart documents store only structural references (`productId`, `variantId`, `quantity`). Live retail prices, stock availability, and stale inventory status are dynamically computed from catalog variants on every cart fetch.
- **Simpler alternative**: Storing price snapshots in the cart.
- **Why alternative rejected**: Requires complex synchronization jobs when prices change and opens vulnerabilities to client-side price tampering.

### ADR-21: Anti-IDOR Authorization via Compound Session Scoping and 404 Responses
- **Why we need it**: Complete protection against unauthorized access to user-owned resources (addresses, cart, orders).
- **Problem it solves**: Attackers incrementing or guessing object IDs to read or alter other users' private data.
- **Why appropriate**: Queries are always scoped to the authenticated session (`Address.findOne({ _id, userId: req.user._id })`). If not found, the API returns `404 NOT_FOUND` rather than `403 FORBIDDEN` to prevent resource enumeration.
- **Simpler alternative**: Checking user ownership in memory after finding the document.
- **Why alternative rejected**: In-memory checks require fetching unauthorized documents into Node memory, risk information leakage, and can expose existence oracles.

---

## 3. Verified Dependency Versions Audit

| Package | Version | Justification |
| :--- | :--- | :--- |
| `express` | `^5.2.1` | Express 5 stable line with native async rejection handling. |
| `morgan` | `^1.12.1` | HTTP access logging. |
| `bcryptjs` | `^3.0.3` | Pure JS bcrypt password hashing with 12 salt rounds (adaptive cost, non memory-hard). |
| `mongoose` | `^8.9.5` | Mongoose 8 schema modeling and MongoDB driver. |
| `express-session` | `^1.18.1` | Stateful session management. |
| `connect-mongo` | `^5.1.0` | MongoDB session store adapter. |
| `zod` | `^3.24.1` | Type-safe runtime schema validation. |
| `vitest` | `^3.2.7` | High performance unit/integration test runner. |
| `supertest` | `^7.0.0` | In-memory HTTP endpoint testing. |
| `react` | `^19.3.0` | Upgraded to current React 19 stable line. |
| `react-dom` | `^19.3.0` | React 19 DOM renderer. |
| `vite` | `^8.3.0` | Upgraded to Vite 8 modern build toolchain. |
| `@vitejs/plugin-react` | `^6.1.1` | React 19 fast refresh plugin for Vite 8. |
