# 18 — Comprehensive Security Architecture & Threat Mitigation Plan

## 1. Security Philosophy: Defense in Depth
Security in our e-commerce platform relies on **Defense in Depth**—layering controls across transport, application, session, database, and operational boundaries.

---

## 2. Threat Modeling & Implementation Matrix

| Attack Vector / Vulnerability | Threat Description | Architectural Mitigation Strategy |
| :--- | :--- | :--- |
| **Credential Stuffing & Brute Force** | Automated bot scripts firing thousands of password guesses against `/api/v1/auth/login`. | **Tiered Rate Limiting (`express-rate-limit`)**: `authLimiter` limits authentication attempts to 10 requests per 15 minutes per IP. Sensitive OTP endpoints limited by `otpLimiter` (5 requests per 15 minutes). |
| **OTP Flooding & SMS/Email Bombing** | Attackers abusing OTP generation to spam victims and exhaust mail service quotas. | **Per-IP Rate Limits & TTL Invalidation**: `otpLimiter` throttles requests. Invalidation of prior active tokens on resend prevents token piling. 5-minute database TTL auto-purges expired tokens. |
| **Session Hijacking & XSS Token Theft** | Cross-Site Scripting (XSS) injecting JavaScript to steal auth tokens from browser storage. | **`httpOnly` + `Secure` + `SameSite` Cookies**: `httpOnly` prevents JavaScript from directly reading the cookie via `document.cookie`, stopping credential exfiltration. (Note: does not prevent scripts from making authenticated requests from the victim browser). `SameSite: 'lax'` reduces cross-site cookie sending, mitigating CSRF. `Secure: true` guarantees HTTPS transmission. |
| **Cross-Site Request Forgery (CSRF)** | Malicious site tricking authenticated browser into sending unauthorized commands. | **`SameSite: 'lax'` + Origin Checking**: Cookies are blocked from being transmitted on cross-origin subresource calls. CORS origin strictly validates allowed frontend origins. |
| **Timing Attacks on Verification Tokens** | Attackers measuring response times to deduce valid OTP digits character by character. | **Constant-Time String Comparison**: Verification uses `crypto.timingSafeEqual` between candidate hash buffer and stored hash buffer to guarantee uniform execution time. |
| **Account Enumeration** | Attackers probing password reset or registration endpoints to discover registered customer emails. | **Uniform Response Messages**: `POST /api/v1/auth/forgot-password` returns the exact same 200 OK message regardless of whether the user exists. |
| **Credential Exposure at Rest** | Database compromise or read replica leakage exposing customer credentials. | **`bcryptjs` (12 Salt Rounds) & `select: false`**: Bcrypt is an adaptive password-hashing algorithm with configurable computational cost, making guessing attacks expensive. Mongoose schema marks `passwordHash` as `select: false` and strips it in `toJSON()` serialization. |
| **Plaintext / Rainbow Table Token Leakage** | Database compromise exposing active one-time verification passwords via rainbow tables. | **Keyed HMAC-SHA256 at Rest**: 6-digit OTPs have only 1M combinations. We store `HMAC(serverSecret, OTP + ":" + purpose + ":" + email)`, defeating offline rainbow table and dictionary attacks even if the database is dumped. |
| **Insecure Direct Object Reference (IDOR)**| Customer modifying URL parameter to view, edit, or delete another customer's profile or delivery address (`/api/v1/addresses/:id`). | **Scoped Session Identity & 404 Response**: Address operations filter queries by `{ _id, userId: req.user._id }`. If an unauthorized ID is queried, the API returns `404 NOT_FOUND` rather than `403 FORBIDDEN` to deny attackers an existence oracle for identifier enumeration. |
| **Client Price Tampering** | Malicious actor altering product prices in browser memory or crafting raw HTTP calls to purchase high-value items at arbitrary prices. | **Dynamic Catalog Derivation**: Client-supplied prices are completely rejected. Cart and checkout engines dynamically derive prices directly from catalog variants stored in MongoDB. |
| **Stock Race Conditions & Overselling** | Multiple concurrent shoppers purchasing the final unit of stock simultaneously, or cross-variant condition collision. | **Atomic $elemMatch Decrement**: Decrements utilize MongoDB's atomic `{ _id: productId, variants: { $elemMatch: { _id: variantId, stock: { $gte: quantity }, isActive: true } } }` with `{ $inc: { "variants.$.stock": -quantity } }`, ensuring both variant identity and quantity refer to the exact same embedded element, preventing negative stock or cross-variant depletion. Multi-item failures trigger compensation rollbacks. |
| **Double-Click Order Duplication** | User impatiently clicking 'Place Order' multiple times or network retry storms duplicating orders and double-decrementing stock. | **Client Idempotency Key & Unique Index**: Frontend generates a unique `idempotencyKey` per checkout attempt. Order service performs an idempotency lookup; MongoDB enforces uniqueness via partial index `{ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }`. Subsequent submissions return the original order immediately without re-decrementing stock. |
| **Wholesale Margin Leakage** | Attackers intercepting API responses to inspect merchant cost prices (`costPrice`). | **Selective Projection**: Customer-facing endpoints strictly execute `.select('-variants.costPrice')`. Cost prices are exclusively accessible on administrative endpoints protected by `requireRole('ADMIN')`. |
| **NoSQL / Mongo Injection** | Attacker submitting `{ "$gt": "" }` in password field to bypass query checks. | **Zod Schema Validation**: Input validator enforces strict primitive types (e.g. `z.string().min(8)`), throwing 422 errors if objects or operators are passed. |
| **Sensitive Data in Logs** | Plaintext credentials appearing in access logs or debugging output. | **Log Scrubbing**: Morgan logger is configured to log request metadata only (method, URL, status code, response time), omitting request bodies. |
| **Payment Secret Exposure** | Leakage of `RAZORPAY_KEY_SECRET` or webhook secrets to frontend client. | **Strict Server Isolation**: Only `RAZORPAY_KEY_ID` is provided to the client for the modal. Key secrets are never injected into client bundles or API responses. |
| **Payment Signature Forgery & Timing Attacks** | Attacker guessing or modifying client callback parameters to fake payment success. | **Constant-Time Verification**: Server re-computes `HMAC-SHA256(order_id|payment_id, KEY_SECRET)` and verifies with `crypto.timingSafeEqual` in constant time, preventing timing side-channel attacks. |
| **Payment IDOR Attack** | User A faking or confirming payment for User B's order by guessing `order_id`. | **Anti-IDOR Ownership Scoping**: Verification queries enforce `payment.userId === req.user._id`. Unauthorized attempts are rejected with 403 Forbidden. |
| **Webhook Signature Bypass & Replay** | Attacker sending fake `payment.captured` webhooks or replaying previously captured webhooks. | **Raw Body Verification + Event Deduplication**: Webhooks verify HMAC signatures against the unparsed raw request body buffer. The unique index on `PaymentEvent.eventId` rejects repeated deliveries. |
| **Wallet IDOR & Balance Tampering** | Malicious user attempting to read, credit, or debit another customer's wallet balance. | **Session Extraction & Role Isolation**: Customer wallet endpoints derive `userId` strictly from authenticated session (`req.user._id`). Admin adjustment endpoints require `requireRole('ADMIN')` and log the modifying `adminId` and reason. |
| **Duplicate Wallet Credit/Debit Attack** | Network retries or parallel requests duplicating promotional credits or wallet payments. | **Compound Unique Ledger Index**: `WalletTransaction` enforces `{ referenceType: 1, referenceId: 1 }` unique constraint, rejecting duplicate mutations for identical business references. |
| **Concurrent Refund Race Conditions & Over-Refund Exploit** | Multiple rapid/parallel refund requests attempting to refund more money than was originally captured before database commits complete. | **Pre-Gateway Atomic Capacity Reservation (ADR-32)**: Server reserves capacity directly on `Payment` via atomic conditional query `{ _id, $expr: { $lte: [{ $add: ["$committedRefundPaise", requestedPaise] }, "$amount"] } }` with `$inc`. On gateway failure, reserved capacity is atomically released. Unique partial index on `Refund` enforces `{ paymentId: 1, idempotencyKey: 1 }`. |
| **Premature / Fraudulent Stock Replenishment on Return** | Customer requests return, inventory is restored immediately, but customer keeps goods or returns damaged/counterfeit items. | **Physical Receipt & Inspection Gate (ADR-33)**: Stock is **never** restored upon return approval. Stock is restored strictly after physical arrival (`RETURN_RECEIVED`) and quality inspection (`RETURN_INSPECTED`) with `inspectionPassed: true` and `restock: true`. Duplicate restoration is guarded via `inventoryRestored: Boolean`. |
| **Unauthorized Refund Creation** | Standard authenticated user or attacker attempting to initiate refunds directly via API. | **Role-Based Access Control**: `POST /api/v1/refunds` and return management endpoints strictly require `requireAuth` + `requireRole("ADMIN")`. Non-admins receive HTTP 403 Forbidden. |
| **Database Transaction Starvation** | External payment gateway refund latency exhausting database connection pools. | **ADR-29 Boundary Isolation**: Razorpay refund network calls execute strictly outside MongoDB transactions. Database mutations run in short, millisecond-duration ACID transactions. |

| **Session Fixation Attack** | Malicious actor forces a pre-set session cookie on victim; rides the session after victim logs in. | **Session Regeneration on Authentication**: `req.session.regenerate()` is executed upon successful login and registration OTP verification. An authoritative `req.session.authTime` is recorded in the newly minted session. |
| **Stale Session Post-Credential Change** | User changes or resets password, but active sessions on compromised devices remain alive. | **`passwordChangedAt` Timestamp Gating**: `user.passwordChangedAt` is updated on password changes, existing sessions are purged from MongoDB, and `requireAuth` dynamically revokes any session issued prior to `passwordChangedAt`. |
| **Clickjacking & Unvetted Script Execution** | Malicious page frames checkout window or injects unauthorized scripts. | **Helmet Content Security Policy & Frame-Ancestors**: Customized CSP with `frameAncestors: ["'none'"]`, explicit script permissions for `checkout.razorpay.com`, and HSTS enabled in production. |
| **State-Changing CSRF via Cross-Origin Requests** | Malicious site exploiting browser cookies during state-changing POST/PUT/DELETE calls. | **Origin / Referer Validation Middleware**: Checks incoming state-changing request origins against `env.FRONTEND_URL`. Exempts HMAC-verified server-to-server Razorpay webhooks. |
| **Payment Gateway Flooding & Webhook DoS** | Malicious bots spamming payment creation or flooding webhook endpoints. | **Specialized Rate Limiters**: `paymentLimiter` (30 req / 15 min) throttles payment initiation and verification; `webhookLimiter` (120 req / 1 min) throttles webhook payloads while allowing burst processing. |

---

## 3. Structured Financial Audit Logging (`backend/src/utils/auditLogger.js`)

All high-risk financial and inventory operations produce structured audit log entries. The audit logger automatically sanitizes metadata to guarantee zero leakage of credentials, tokens, OTPs, or gateway secrets.

### Supported Financial Audit Actions:
- `ADMIN_WALLET_CREDIT`: Administrative credit to customer wallet.
- `ADMIN_WALLET_DEBIT`: Administrative debit from customer wallet.
- `ADMIN_INITIATED_REFUND`: Administrative creation of Razorpay gateway refund.
- `ADMIN_APPROVED_RETURN`: Administrative approval of customer return request.
- `ADMIN_REJECTED_RETURN`: Administrative rejection of customer return request.

### Secret Redaction Engine:
```javascript
const SENSITIVE_KEYS = new Set([
  "password", "passwordhash", "token", "otp", "secret",
  "keysecret", "authorization", "cookie", "razorpay_signature"
]);
```
Every audit log record captures: `timestamp`, `action`, `adminId`, `targetId`, sanitized `details`, and `ipAddress`.

---

## 4. Rate Limiting Configuration Registry (`backend/src/middlewares/rateLimiter.middleware.js`)

```javascript
// Global API Limiter: 300 req / 15 min
const apiRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });

// Auth Limiter (Login, Registration): 10 req / 15 min
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many authentication attempts..." });

// OTP Limiter (Verification, Resend, Reset): 5 req / 5 min
const otpLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 5, message: "Too many OTP requests..." });

// Payment Limiter (Create, Verify, Retry): 30 req / 15 min
const paymentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: "Too many payment requests..." });

// Webhook Limiter (Razorpay Webhook Endpoint): 120 req / 1 min
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, message: "Webhook rate limit exceeded..." });
```

---

## 5. Environment & Secret Governance
- **Git Protection**: `.env` is permanently ignored via `.gitignore`. `.env.example` documents required environment keys with safe placeholders.
- **Session Secrets**: `SESSION_SECRET` requires a minimum 32-character high-entropy string in production.
- **Fail-Fast Configuration**: `backend/src/config/env.js` validates all critical environment variables on startup, terminating immediately with an informative error if variables are missing.
- **Client Boundary Protection**: Only `VITE_API_URL` is exposed to the frontend; backend secrets are never prefixed with `VITE_`.

---

## 6. AWS Cloud Security Groups & Network Isolation Policies
- **Host Firewall (Security Group)**:
  - Inbound Port 80 (HTTP) open to `0.0.0.0/0` (redirects 301 to HTTPS via Nginx).
  - Inbound Port 443 (HTTPS) open to `0.0.0.0/0` (TLS 1.2/1.3 encrypted browser traffic).
  - Inbound Port 22 (SSH) strictly restricted to the administrator's static IP (`Admin_IP/32`).
  - Backend Port 5000 is **strictly blocked** from the public internet; accessible only internally via Nginx reverse proxy loopback.
- **Database Network Isolation (MongoDB Atlas)**:
  - Atlas network access whitelist is restricted strictly to the EC2 Elastic IP.
  - TLS 1.3 encryption in-transit for all database connections (`mongodb+srv://`).
- **AWS S3 Least Privilege**:
  - S3 bucket blocks all public ACLs and public policies.
  - Client uploads use short-lived (5-minute) Presigned URLs generated by the backend with `@aws-sdk/s3-request-presigner`.



