# 28 — Missing Requirements Analysis & Future Improvements

## 1. System Review & Discovered Missing Requirements
In real-world e-commerce platforms, basic tutorials frequently omit critical edge cases, leading to catastrophic failure modes such as stock overselling, client-side price tampering, financial discrepancies, and unhandled network drops. 

Below is an exhaustive architectural review of the missing requirements, categorized by operational domain.

---

## 2. Detailed Evaluation of Critical Additions

### 2.1 Security & Infrastructure

| Identified Requirement | Why It Is Crucial | MVP Scope? | Complexity |
| :--- | :--- | :--- | :--- |
| **Server-Side Price Verification** | Clients can easily intercept and modify checkout payloads (e.g. changing ₹10,000 to ₹10 via DevTools or Postman). The server must re-fetch and calculate every item's price directly from the database at the exact millisecond of checkout. | **YES (MVP)** | High |
| **Server-Side Stock Verification & Atomic Decrement** | Prevents race conditions where two customers buy the last remaining item simultaneously. An atomic `$inc: -quantity` with `{ stock: { $gte: quantity } }` ensures stock never drops below 0. | **YES (MVP)** | High |
| **Rate Limiting & Brute-Force Protection** | Prevents automated credential stuffing on `/api/v1/auth/login` and OTP exhaustion attacks on `/api/v1/auth/send-otp`. | **YES (MVP)** | Low |
| **API Versioning (`/api/v1`)** | Shields mobile or third-party clients from breaking changes when endpoints evolve. | **YES (MVP)** | Low |
| **Health Check Endpoint (`/api/v1/health`)** | Essential for AWS EC2 / Nginx uptime monitoring, load balancer health checks, and CI/CD pipelines. | **YES (MVP)** | Low |
| **Session Expiration & Auto-Revocation** | Inactive sessions must expire via MongoDB TTL indexes after 7 days; logging out must immediately purge the server session record. | **YES (MVP)** | Medium |

### 2.2 Payment & Financial Operations

| Identified Requirement | Why It Is Crucial | MVP Scope? | Complexity |
| :--- | :--- | :--- | :--- |
| **Payment Retry Engine** | When a customer's bank card fails or their internet drops mid-transaction, discarding their cart forces them to re-select items. Retrying payment on the existing order in `PAYMENT_FAILED` state drastically increases conversion. | **Should Have (v1.1)** | High |
| **Webhook Idempotency & Signature Verification** | Razorpay webhooks can be delivered multiple times for a single event. Processing a payment webhook twice without an idempotency check could trigger duplicate order confirmations or double wallet credits. | **YES (MVP)** | High |
| **Automated Tax Invoice Generation (PDF)** | Customers require proof of purchase; e-commerce regulations mandate GST/tax breakdown. Invoices are generated dynamically and stored in S3. | **Should Have (v1.1)** | Medium |
| **Atomic Wallet Ledger** | Wallets must operate as double-entry immutable ledgers (`CREDIT`, `DEBIT`, `REFUND`), never as an un-audited raw number mutation. | **Should Have (v1.1)** | High |

### 2.3 UX, Lifecycle & State Management

| Identified Requirement | Why It Is Crucial | MVP Scope? | Complexity |
| :--- | :--- | :--- | :--- |
| **Strict Order State Machine** | Prevents illegal state jumps (e.g. jumping from `PENDING_PAYMENT` directly to `DELIVERED`, or cancelling an order after it has already `SHIPPED`). | **YES (MVP)** | Medium |
| **Empty, Loading & Error UI States** | A blank screen during slow network requests destroys trust. Skeletons, empty search result illustrations, and clear error banners are essential for production grade UX. | **YES (MVP)** | Medium |
| **Historical Order Snapshotting** | If an admin changes a product name or price from ₹500 to ₹800 next month, old order receipts must still display ₹500. Orders must embed immutable copies of product attributes at purchase time. | **YES (MVP)** | Medium |

---

## 3. Features Intentionally Postponed (Post-v1 / Phase 2)

The following architectural concepts were evaluated and intentionally deferred to keep the codebase clean, understandable, and free from over-engineering:

### 1. Redis Caching & In-Memory Store
- **Why postponed**: MongoDB Atlas with compound indexes easily handles thousands of read queries for this project scale. Adding Redis introduces extra hosting costs, caching synchronization headaches (cache invalidation bugs), and connection overhead.
- **When to introduce**: When product catalog read traffic exceeds 5,000 requests per minute.

### 2. Elasticsearch / Algolia Dedicated Search
- **Why postponed**: MongoDB text indexes and regex indexing satisfy multi-field search (title, description, brand, category) for catalogs under 50,000 items. Elasticsearch adds complex sync pipelines and massive RAM usage.
- **When to introduce**: When typo-tolerance (fuzzy search) and faceted search latency across millions of SKUs becomes critical.

### 3. Automated Courier API Integration (Shiprocket / Delhivery)
- **Why postponed**: Courier partner sandbox environments require corporate GST registrations and API keys. We simulate tracking numbers and shipment status updates via Admin Order Management.
- **When to introduce**: When real-world physical warehouse shipping is initiated.

### 4. Microservices & Message Brokers (Kafka / RabbitMQ)
- **Why postponed**: A modular monolith with clear domain services (AuthService, OrderService, PaymentService) provides superior developer velocity, zero distributed transaction bugs, and trivial local debugging for interviewers.
- **When to introduce**: Only when independent engineering teams need to deploy order and catalog services separately.

### 5. Multi-Currency Support
- **Why postponed**: Introducing real-time foreign exchange rate feeds and multi-currency gateway settlements adds substantial complexity with little educational benefit. Standardizing on INR keeps Razorpay workflows predictable and robust.
