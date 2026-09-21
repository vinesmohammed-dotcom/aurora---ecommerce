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
| **`products`** | `{ "variants.sku": 1 }` | Unique Sparse | Variant inventory updates and warehouse SKU lookups | Guarantees SKU uniqueness across all embedded variant items across the catalog. Sparse flag saves memory. |
| **`products`** | `{ category: 1, isActive: 1, basePrice: 1 }` | Compound | Shop page filtering by category, active status, sorted by price | **Core Catalog Index**. Satisfies Equality-Sort-Range (ESR) rule. Allows MongoDB to filter active products in category and sort by price using index order without in-memory sorting. |
| **`products`** | `{ name: "text", description: "text" }` | Text Index | Search bar keyword queries (`$text: { $search: query }`) | Enables stemming, stop-word removal, and keyword scoring across title and description without loading an external search cluster. High write cost on product creation, but product writes are low frequency. |
| **`orders`** | `{ orderNumber: 1 }` | Unique | Order lookup by customer/admin reference code | Fast lookup for tracking and support requests. |
| **`orders`** | `{ user: 1, createdAt: -1 }` | Compound | "My Orders" customer portal listing | Satisfies user filter and newest-first chronological sort (`sort({ createdAt: -1 })`) with zero in-memory sort buffer consumption. |
| **`orders`** | `{ orderStatus: 1, createdAt: -1 }` | Compound | Admin order fulfillment dashboard filters | Allows admin to quickly query all `PROCESSING` or `RETURN_REQUESTED` orders sorted by age. |
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
