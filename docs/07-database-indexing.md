# 07 — Database Indexing Strategy & Performance Plan

## 1. Indexing Principles: The Read vs Write Trade-Off
In MongoDB, indexes dramatically accelerate query performance by converting slow **Collection Scans (COLLSCAN)** into logarithmic **Index Scans (IXSCAN)**. However, every additional index imposes two penalties:
1. **Write Overhead**: On every `insert`, `update`, and `delete`, MongoDB must update the primary document *plus* all associated B-Tree index structures.
2. **RAM Consumption**: For optimal performance, the Working Set (all indexes + hot data) must fit entirely within WiredTiger cache (system RAM).

Therefore, this project strictly defines indexes that match our high-frequency query patterns, avoiding speculative or redundant indexes.

---

## 2. Production Index Registry

| Collection | Indexed Fields | Index Type | Target Query Pattern | Performance Benefit & Trade-Off |
| :--- | :--- | :--- | :--- | :--- |
| **`users`** | `{ email: 1 }` | Unique | Customer login, registration check (`findOne({ email })`) | **Essential**. Enforces uniqueness at the database engine level; instant $O(\log N)$ lookup. Zero read trade-off; tiny write penalty on signup. |
| **`otps`** | `{ expiresAt: 1 }` | TTL Index (`expireAfterSeconds: 0`) | Automatic purging of expired OTPs | **Essential**. MongoDB background thread removes expired OTPs automatically every 60 seconds without cron scripts or scheduled workers. |
| **`otps`** | `{ email: 1, purpose: 1 }` | Compound | Fetching active OTP on verify submission | Prevents scanning unrelated OTP records. Clean compound index matching verification filter. |
| **`products`** | `{ slug: 1 }` | Unique | Product detail page lookup (`/product/:slug`) | Guarantees human-friendly URL uniqueness. Instant single-document retrieval. |
| **`products`** | `{ "variants.sku": 1 }` | Unique Sparse | Cross-document SKU uniqueness and warehouse lookups | Enforces SKU uniqueness across different Product documents. *(Note: Because MongoDB multikey indexes do not guarantee uniqueness of repeated values within the same array/document, this index is paired with application-level validation within the product document).* |
| **`products`** | `{ category: 1, isActive: 1, basePrice: 1 }` | Compound | Shop page filtering by category, active status, sorted by price | **Core Catalog Index**. Satisfies Equality-Sort-Range (ESR) rule. Allows MongoDB to filter active products in category and sort by price using index order without in-memory sorting. |
| **`products`** | `{ name: "text", description: "text", tags: "text" }` | Text Index | Search bar keyword queries (`$text: { $search: query }`) | Enables stemming, stop-word removal, and keyword scoring across name, description, and searchable tags. |
| **`addresses`** | `{ userId: 1, isDefault: -1 }` | Compound | Fetching user addresses sorted with default first | Instant index scan filtered by owner `userId` with default address positioned at index head. |
| **`addresses`** | `{ userId: 1 }` (partial: `{ isDefault: true }`) | Unique Partial | Enforcing at most one default address per user at database level | **Strict Single-Default Guarantee**. Only indexes documents where `isDefault === true`. Completely permits multiple non-default addresses while strictly forbidding duplicate defaults for the same user. |
| **`cart`** | `{ userId: 1 }` | Unique | Customer cart retrieval (`findOne({ userId })`) | Guarantees exactly one shopping cart document per customer account. Instant point lookup. |
| **`wishlist`** | `{ userId: 1 }` | Unique | Customer wishlist retrieval (`findOne({ userId })`) | Guarantees exactly one wishlist document per customer account. |
| **`offers`** | `{ targetType: 1, product: 1, isActive: 1 }` | Compound | Product-level active offer lookup | Instant retrieval during checkout calculation. |
| **`offers`** | `{ targetType: 1, category: 1, isActive: 1 }` | Compound | Category-level active offer lookup | Instant retrieval during checkout calculation. |
| **`offers`** | `{ startDate: 1, endDate: 1, isActive: 1 }` | Compound | Active window evaluation | Fast filtering of current valid campaigns. |
| **`coupons`** | `{ code: 1 }` | Unique | Promotional voucher lookup | Guarantees unique voucher codes in uppercase; instant point lookup. |
| **`coupons`** | `{ isActive: 1, startDate: 1, expiryDate: 1 }` | Compound | Active coupon validity evaluation | Fast filtering of non-expired coupons. |
| **`orders`** | `{ orderNumber: 1 }` | Unique | Order lookup by customer/admin reference code | Fast lookup for tracking and support requests. |
| **`orders`** | `{ userId: 1, createdAt: -1 }` | Compound | "My Orders" customer portal listing | Satisfies user filter and newest-first chronological sort (`sort({ createdAt: -1 })`) with zero in-memory sort buffer consumption. |
| **`orders`** | `{ orderStatus: 1 }` | Index | Admin order fulfillment dashboard filters | Allows admin to quickly query orders by lifecycle state (`CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`). |
| **`orders`** | `{ idempotencyKey: 1 }` (partial: `{ $type: "string" }`) | Unique Partial | Double-click / retry duplicate order prevention | Prevents concurrent duplicate submissions from creating multiple orders or double-charging inventory. |
| **`payments`** | `{ razorpayOrderId: 1 }` | Unique | Razorpay signature verification and webhook dispatch | Instant lookup of order during synchronous payment verification and asynchronous webhook arrivals. |
| **`wallet_transactions`**| `{ wallet: 1, createdAt: -1 }` | Compound | Customer wallet history page | Fast pagination of user ledger transactions in reverse chronological order. |
| **`sessions`** | `{ expires: 1 }` | TTL Index | `connect-mongo` session auto-expiration | Deletes stale sessions automatically to prevent unbounded session database growth. |

---

## 3. The ESR (Equality, Sort, Range) Rule in Catalog Indexing
When creating compound indexes for the e-commerce shop page:
1. **Equality (`category`, `isActive`)**: Fields with exact equality matches come first.
2. **Sort (`basePrice`)**: Fields used for ordering come next.
3. **Range (`basePrice: { $gte: min, $lte: max }`)**: Range filters come last.

By structuring `{ category: 1, isActive: 1, basePrice: 1 }`, MongoDB evaluates the category filter, leverages the index structure to order items by price, and eliminates memory-intensive in-memory sort operations (`SORT_KEY_GENERATOR`), preventing `Executor error: Sort exceeded memory limit of 33554432 bytes`.

---

## 4. Deep-Dive: Partial Filter Expression vs Sparse Indexes

### Why a Sparse Index Fails for Default Addresses
A **Sparse Index** only excludes documents where the indexed field is *completely missing* (`null` or `undefined`). 
In our Mongoose schema, `isDefault` is a Boolean (`false` or `true`). 
When a user creates a non-default address, `isDefault` is explicitly set to `false`. 
A sparse index on `{ userId: 1, isDefault: 1 }` will index all documents where `isDefault` is `false`. Therefore, if the index were marked `unique: true, sparse: true`, the user would be forbidden from saving a *second* non-default address because `{ userId: 123, isDefault: false }` would collide with `{ userId: 123, isDefault: false }` with an `E11000 duplicate key error`!

### Why a Partial Filter Index Succeeds
A **Partial Index** (`partialFilterExpression: { isDefault: true }`) instructs the MongoDB WiredTiger storage engine to *only insert an index entry if the document matches the exact filter predicate*.
- When `isDefault` is `false`: MongoDB skips the index entirely. A user can have 10, 50, or 100 non-default addresses with zero index collisions.
- When `isDefault` is `true`: MongoDB writes an entry `{ userId: 123 }` into the unique index. If a second address for user `123` attempts to set `isDefault: true`, MongoDB catches the collision and raises `E11000 duplicate key error`.
- Result: 100% database-enforced consistency guarantee of at most one default address per customer with zero risk to non-default addresses.
