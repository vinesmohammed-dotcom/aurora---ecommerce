# 25 — Technical Interview Guide & Architecture Defense

## 1. Overview
This project is engineered specifically to serve as a centerpiece portfolio demonstration. When interviewing for Full-Stack, Backend, or Frontend engineering roles, interviewers want to test **fundamental software engineering depth**—not whether you can follow a basic tutorial, but whether you understand concurrency, security, database performance, and edge-case resilience.

---

## 2. Core Interview Topics & Defense Guide

### 2.1 Concurrency & Race Condition Prevention in Inventory Management
- **What the interviewer will ask**: *"What happens if two customers attempt to purchase the last available sneaker variant (`stock = 1`) at the exact same millisecond? How does your system prevent overselling?"*
- **What you must understand**:
  - In a multi-user environment, traditional "check-then-act" (`if (stock >= qty) { stock -= qty; save(); }`) fails because both requests read `stock = 1` before either writes, resulting in negative inventory (`stock = -1`).
  - Distributed locks (Redlock) add unnecessary complexity for single-database systems.
  - MongoDB provides document-level ACID guarantees. We execute an **atomic conditional update**:
    ```javascript
    Product.findOneAndUpdate(
      { _id: productId, "variants._id": variantId, "variants.stock": { $gte: quantity } },
      { $inc: { "variants.$.stock": -quantity } },
      { new: true }
    );
    ```
    The condition `{ "variants.stock": { $gte: quantity } }` acts as a database-level mutex. Only one operation matches and decrements; the second returns `null` and throws an HTTP 409 Conflict.
- **Where demonstrated**: [14-cart-and-checkout.md](file:///c:/Users/vines/react%20first%20project/docs/14-cart-and-checkout.md) and `backend/src/services/checkout.service.js`.

---

### 2.2 Session-Based Auth vs Stateless JWT
- **What the interviewer will ask**: *"Why did you choose session-based cookies with MongoDB instead of stateless JWTs stored in localStorage?"*
- **What you must understand**:
  - **Token Theft Vulnerability**: Anything stored in `localStorage` is accessible to JavaScript. An XSS flaw (or malicious third-party NPM dependency) can exfiltrate JWTs. `httpOnly` cookies cannot be accessed by client scripts.
  - **Revocation Impossibility**: Stateless JWTs cannot be invalidated on demand without maintaining an in-memory blocklist (which turns them back into stateful sessions!). If an administrator bans a malicious user or a user clicks "Logout from all devices", a JWT remains valid until its expiration timestamp.
  - **Session Store Trade-off**: Sessions require a database lookup per request. We used MongoDB TTL indexes with `connect-mongo` to keep operations simple and free without adding Redis.
- **Where demonstrated**: [11-authentication.md](file:///c:/Users/vines/react%20first%20project/docs/11-authentication.md) and [27-decisions.md](file:///c:/Users/vines/react%20first%20project/docs/27-decisions.md).

---

### 2.3 Payment Webhook Synchronization & Idempotency
- **What the interviewer will ask**: *"What happens if the customer completes payment on Razorpay, but closes their laptop lid before the frontend redirects to your verification endpoint? How do you fulfill the order without double-charging?"*
- **What you must understand**:
  - **Dual-Channel Confirmation**: Payment relies on both synchronous client callback and asynchronous server webhooks. If the client drops, Razorpay's server sends an independent `payment.captured` webhook directly to our backend.
  - **HMAC Signature Verification**: Webhooks are authenticated by computing HMAC-SHA256 with the shared webhook secret and comparing with `X-Razorpay-Signature` via `crypto.timingSafeEqual`.
  - **Idempotency**: Webhook deliveries can be retried by Razorpay. Our handler checks `payment.status`. If already `SUCCESS`, it logs an idempotency hit and returns HTTP 200 without executing stock decrements or wallet credits a second time.
- **Where demonstrated**: [13-payment-flow.md](file:///c:/Users/vines/react%20first%20project/docs/13-payment-flow.md).

---

### 2.4 Database Modeling: Embedded vs Referenced in MongoDB
- **What the interviewer will ask**: *"Why did you embed variants inside the Product document rather than creating a separate ProductVariant collection?"*
- **What you must understand**:
  - **Query Patterns**: Catalog browsing and product detail pages require product metadata and variant attributes simultaneously. Embedding allows fetching all variant dimensions in a single indexed query with zero `$lookup` JOIN overhead.
  - **Document Boundaries**: Variant stock updates occur in the same document context.
  - **Trade-off Awareness**: MongoDB has a 16MB document size limit. For a typical catalog item with 5–20 variants, document size is under 50KB. If each product had 10,000 variants, we would migrate to referenced collections.
- **Where demonstrated**: [07-database-design.md](file:///c:/Users/vines/react%20first%20project/docs/07-database-design.md).

---

### 2.5 Multi-Stage Checkout Security
- **What the interviewer will ask**: *"How do you prevent a malicious user from modifying the price or coupon discount using Postman or browser DevTools?"*
- **What you must understand**:
  - **Zero Client Trust**: The frontend sends only intent (selected variant IDs and quantities). The server re-queries the database for prices, recalculates active offers, re-evaluates coupon eligibility rules, and enforces minimum order values at the exact moment of order creation.
  - The payment gateway order is generated entirely server-side with the recomputed total.
- **Where demonstrated**: [14-cart-and-checkout.md](file:///c:/Users/vines/react%20first%20project/docs/14-cart-and-checkout.md).

---

### 2.6 Password Hashing Architecture: Adaptive Cost vs Fast Algorithms
- **What the interviewer will ask**: *"Why did you choose bcrypt with cost factor 12 rather than SHA-256 or MD5 for user passwords?"*
- **What you must understand**:
  - **Adaptive Computational Cost**: Bcrypt is an adaptive password-hashing algorithm with a configurable computational cost, designed to make password-guessing attacks expensive. The work factor (salt rounds) can be increased over time as CPUs become faster.
  - **Defeating Fast Hardware**: SHA-256 is designed for fast checksums. On modern GPUs, an attacker can test billions of SHA-256 hashes per second. Bcrypt cost factor 12 forces 4,096 iterations (~250ms per check), making brute-force attacks computationally and financially impossible.
- **Where demonstrated**: `backend/src/modules/users/user.model.js` and [18-security.md](file:///c:/Users/vines/react%20first%20project/docs/18-security.md).

---

### 2.7 Keyed HMAC-SHA256 for Short Numeric OTPs
- **What the interviewer will ask**: *"If an attacker obtains a read-only dump of your MongoDB database, can they crack your 6-digit email verification OTPs?"*
- **What you must understand**:
  - **Small Entropy Problem**: A 6-digit numeric OTP has only $10^6 = 1,000,000$ combinations. An unkeyed hash `SHA-256(OTP)` could be reversed in milliseconds using a precomputed rainbow table.
  - **Server-Secret Keyed Construction**: We store `HMAC(serverSecret, OTP + ":" + purpose + ":" + email)`. Without the server secret (which is kept strictly in environment variables and never written to the database), an attacker cannot generate or verify rainbow tables offline.
- **Where demonstrated**: `backend/src/modules/auth/otp.model.js` and [11-authentication.md](file:///c:/Users/vines/react%20first%20project/docs/11-authentication.md).

---

### 2.8 Cookie Security Realities: HttpOnly, SameSite, and Secure
- **What the interviewer will ask**: *"Does setting HttpOnly on your session cookie completely eliminate XSS vulnerabilities?"*
- **What you must understand**:
  - **HttpOnly Reality**: `HttpOnly` prevents client-side JavaScript (`document.cookie`) from directly reading the cookie string. This prevents an attacker from exfiltrating credentials to their external command-and-control server. However, it does **not** prevent malicious scripts from executing authenticated API requests from the victim's browser, because browsers automatically attach cookies to same-origin requests.
  - **SameSite Reality**: `SameSite: 'lax'` prevents cross-site requests from transmitting cookies in sub-resource requests (images, iframes), providing critical CSRF protection.
  - **Secure Reality**: `Secure: true` ensures the cookie is only transmitted over encrypted TLS/HTTPS connections in production.
- **Where demonstrated**: `backend/src/config/session.js` and [18-security.md](file:///c:/Users/vines/react%20first%20project/docs/18-security.md).

---

### 2.9 Dual Health Probes: Liveness vs Readiness and Graceful Shutdown
- **What the interviewer will ask**: *"Why do you have two distinct health endpoints (`/health` vs `/health/ready`), and what happens during a deployment shutdown?"*
- **What you must understand**:
  - **Liveness (`/api/v1/health` and `/api/v1/health/live`)**: Answers *"Is the Node.js process alive and able to process HTTP requests?"* If this fails or hangs (e.g., event loop deadlock), the container orchestrator (Docker / Kubernetes) restarts the container. It does NOT check external databases.
  - **Readiness (`/api/v1/health/ready`)**: Answers *"Is the service currently capable of handling live customer transactions?"* It verifies that the MongoDB connection is alive.
  - **Graceful Shutdown & Connection Draining**: Upon receiving `SIGTERM`/`SIGINT`, the server immediately flags `isShuttingDown = true`. The readiness probe immediately responds with HTTP 503 `shutting_down`, signaling reverse proxies and load balancers to stop routing new traffic. `server.close()` allows in-flight checkout requests to finish within a 10-second drain window before closing database connections.
- **Where demonstrated**: `backend/src/modules/health/health.controller.js`, `backend/src/server.js`, and `docker-compose.prod.yml`.

---

### 2.10 Testing Strategy: In-Memory API Integration vs Headless Browser Smoke Testing
- **What the interviewer will ask**: *"How do you structure your automated testing strategy to balance fast CI/CD execution speed with real-world user interface confidence?"*
- **What you must understand**:
  - **In-Memory Supertest Integration (Fast & Deep)**: 205 tests run in ~74 seconds across 18 test files using Vitest and Supertest. It tests complex transactional logic (concurrency race conditions, atomic increments, multi-tier pricing, wallet ledgers, refund capacity checks) in-memory without spinning up browsers or operating system network sockets.
  - **Playwright Headless Browser Smoke Suite (Real DOM & Routing)**: Complements backend tests by launching Chromium to test compiled production bundles in seconds. It verifies brand layout, route navigation (avoiding 404 traps), catalog search filters, and active authentication form controls.
  - **Separation of Concerns**: We don't test 100 edge cases in Playwright (which would take 20 minutes and suffer from browser flakiness); we test domain logic in Supertest and verify UI integrity with Playwright smoke tests.
- **Where demonstrated**: `backend/tests/` and `frontend/tests/e2e/smoke.spec.js`.
