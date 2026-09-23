# 09 — REST API Endpoint Specification & Documentation Plan

## 1. RESTful Standards & Versioning
All API endpoints follow strict REST conventions and are versioned under `/api/v1`. Correct semantic HTTP verbs (`GET`, `POST`, `PATCH`, `DELETE`) are strictly enforced. Responses follow the unified schema detailed in [10-api-response-standard.md](file:///c:/Users/vines/react%20first%20project/docs/10-api-response-standard.md).

---

## 2. API Endpoint Catalog

### 2.1 Authentication (`/api/v1/auth`)
| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/register` | Register new customer & dispatch 6-digit OTP | No | Public | `{ name, email, password, phone? }` | 201, 409, 422 |
| `POST` | `/verify-registration-otp` | Verify OTP, mark `isVerified: true`, create session | No | Public | `{ email, otp }` | 200, 400, 404 |
| `POST` | `/resend-registration-otp` | Invalidate prior OTPs & dispatch fresh 6-digit OTP | No | Public | `{ email }` | 200, 400, 404 |
| `POST` | `/login` | Authenticate credentials & set `connect.sid` cookie | No | Public | `{ email, password }` | 200, 401, 403, 422 |
| `POST` | `/logout` | Destroy server session & clear cookie | Yes | User/Admin | None | 200, 401 |
| `GET` | `/me` | Get current authenticated user profile | Yes | User/Admin | None | 200, 401 |
| `POST` | `/forgot-password` | Request password reset OTP (uniform response) | No | Public | `{ email }` | 200, 422 |
| `POST` | `/reset-password` | Reset password using 6-digit OTP | No | Public | `{ email, otp, newPassword }` | 200, 400, 422 |
| `PUT` | `/change-password` | Update account password when authenticated | Yes | User/Admin | `{ currentPassword, newPassword }` | 200, 400, 401, 422 |
| `POST` | `/request-email-change` | Send verification OTP to requested new email | Yes | User/Admin | `{ newEmail }` | 200, 400, 409, 422 |
| `POST` | `/verify-email-change` | Verify OTP and atomically update user email | Yes | User/Admin | `{ newEmail, otp }` | 200, 400, 422 |

### 2.2 Customer Account & Profile (`/api/v1/users`)
| Method | Endpoint | Purpose | Auth | Role | Request Body / Params | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/profile` | Get current user profile (scoped to session) | Yes | User/Admin | None | 200, 401 |
| `PUT` | `/profile` | Update profile info (name, phone) | Yes | User/Admin | `{ name?, phone? }` | 200, 400, 401, 422 |
| `GET` | `/addresses` | List all saved addresses | Yes | User | None | 200, 401 |
| `POST` | `/addresses` | Add new shipping address | Yes | User | `{ fullName, phone, street, city, state, pincode, isDefault }` | 201, 400 |
| `PATCH` | `/addresses/:id` | Edit existing address | Yes | User | Partial address fields | 200, 400, 404 |
| `DELETE`| `/addresses/:id` | Delete saved address | Yes | User | None | 200, 404 |

### 2.3 Catalog Browsing (`/api/v1/products`, `/api/v1/categories`, `/api/v1/brands`)
| Method | Endpoint | Purpose | Auth | Role | Query Params | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/products` | List active products with filters, sorting, and pagination (excludes `costPrice`) | No | Public | `page, limit, category, brand, minPrice, maxPrice, sort, search, inStock` | 200, 400 |
| `GET` | `/products/:slug` | Get product detail by unique slug with active variants (excludes `costPrice`) | No | Public | None | 200, 404 |
| `GET` | `/categories` | List active categories (or paginated with search) | No | Public | `page, limit, search` | 200 |
| `GET` | `/categories/:slug` | Get single category by slug | No | Public | None | 200, 404 |
| `GET` | `/brands` | List active brands (or paginated with search) | No | Public | `page, limit, search` | 200 |
| `GET` | `/brands/:slug` | Get single brand by slug | No | Public | None | 200, 404 |

> [!IMPORTANT]
> **Data Protection Rule**: Public catalog endpoints strictly project away `variants.costPrice` via `.select('-variants.costPrice')`. Wholesale margins are never exposed to storefront visitors.

### 2.4 Customer Address Management (`/api/v1/addresses`)
All address endpoints require an active authenticated customer session (`req.user`). IDOR defense is enforced on every query by scoping with `userId: req.user._id`. Unauthorized attempts return `404 NOT_FOUND` to prevent ID enumeration.

| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/addresses` | List all addresses for current user (default address first) | Yes | User/Admin | None | 200, 401 |
| `POST` | `/addresses` | Create new delivery address (auto-default if first address) | Yes | User/Admin | `{ fullName, phone, addressLine1, addressLine2?, city, state, postalCode, country?, label?, isDefault? }` | 201, 400, 401, 422 |
| `GET` | `/addresses/:id` | Get single address by ID (ownership verified) | Yes | User/Admin | None | 200, 401, 404 |
| `PUT` | `/addresses/:id` | Update address fields (ownership verified) | Yes | User/Admin | `{ fullName?, phone?, addressLine1?, addressLine2?, city?, state?, postalCode?, country?, label?, isDefault? }` | 200, 400, 401, 404, 422 |
| `PATCH` | `/addresses/:id/default` | Set address as default (atomically resets other defaults) | Yes | User/Admin | None | 200, 401, 404 |
| `DELETE`| `/addresses/:id` | Delete address (auto-promotes another if deleting default) | Yes | User/Admin | None | 200, 401, 404 |

### 2.5 Shopping Cart & Wishlist (`/api/v1/cart`, `/api/v1/wishlist`)
Client prices are never accepted. Cart prices, discounts, and inventory availability are dynamically derived from active catalog variants on every retrieval. Wholesale `costPrice` is strictly omitted from all customer responses.

| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/cart` | Get customer cart with live catalog prices & stale stock flags | Yes | User/Admin | None | 200, 401 |
| `POST` | `/cart/items` | Add product variant to cart (max 10 units per SKU) | Yes | User/Admin | `{ productId, variantId, quantity }` | 200, 400, 401, 404, 422 |
| `PATCH` | `/cart/items/:variantId` | Update item quantity in cart (min 1, max 10) | Yes | User/Admin | `{ quantity }` | 200, 400, 401, 404, 422 |
| `DELETE`| `/cart/items/:variantId` | Remove specific variant item from cart | Yes | User/Admin | None | 200, 401, 404 |
| `DELETE`| `/cart` | Clear entire shopping cart | Yes | User/Admin | None | 200, 401 |
| `GET` | `/wishlist` | View user's wishlist (omits wholesale costPrice) | Yes | User/Admin | None | 200, 401 |
| `POST` | `/wishlist/items` | Add product to wishlist (enforces set uniqueness via `$addToSet`) | Yes | User/Admin | `{ productId }` | 200, 400, 401, 404, 422 |
| `DELETE`| `/wishlist/items/:productId` | Remove product from wishlist | Yes | User/Admin | None | 200, 401, 404 |
| `POST` | `/wishlist/toggle` | Toggle product in wishlist (adds if absent, removes if present) | Yes | User/Admin | `{ productId }` | 200, 400, 401, 404, 422 |

### 2.5 Checkout & Orders (`/api/v1/checkout`, `/api/v1/orders`)
| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/checkout/apply-coupon` | Validate & preview coupon discount | Yes | User | `{ code }` | 200, 400, 404 |
| `POST` | `/orders/create` | Execute checkout pipeline & create order | Yes | User | `{ addressId, couponCode, useWallet, paymentMethod }` | 201, 400, 409 |
| `GET` | `/orders/my-orders` | List user's orders (paginated) | Yes | User | `page, limit` | 200 |
| `GET` | `/orders/:id` | View detailed single order snapshot | Yes | User/Admin | None | 200, 403, 404 |
| `PATCH` | `/orders/:id/cancel` | Cancel order (triggers refund/stock restock) | Yes | User/Admin | `{ reason }` | 200, 400, 403 |
| `POST` | `/orders/:id/return` | Submit return request within 7-day window | Yes | User | `{ reason, notes }` | 200, 400, 403 |
| `GET` | `/orders/:id/invoice` | Download generated PDF tax invoice | Yes | User/Admin | None | 200, 404 |

### 2.6 Payments (`/api/v1/payments`)
| Method | Endpoint | Purpose | Auth | Role | Request Body / Headers | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/verify-signature` | Verify Razorpay HMAC-SHA256 signature | Yes | User | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | 200, 400 |
| `POST` | `/retry` | (Phase 6) Generate fresh Razorpay order for failed order | Yes | User | `{ orderId }` | 200, 400 |
| `POST` | `/webhook` | (Phase 6) Asynchronous Razorpay webhook ingestion | No | Gateway | Headers: `x-razorpay-signature`, Body: Webhook payload | 200, 400 |

### 2.7 Checkout Calculation Engine (`/api/v1/checkout`)
| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/summary` | Calculate authoritative checkout pricing, offers, coupons & delivery | Yes | User | `{ addressId?, couponCode? }` | 200, 400, 401, 422 |
| `POST` | `/coupon` | Apply coupon code and recalculate checkout totals | Yes | User | `{ couponCode, addressId? }` | 200, 400, 401, 404, 422 |

### 2.8 Promotional Offers (`/api/v1/offers` & `/api/v1/admin/offers`)
| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/offers` | List promotional offers | No | Public | Query: `targetType?, isActive?` | 200 |
| `GET` | `/offers/:id` | Get offer details | No | Public | None | 200, 404 |
| `GET` | `/admin/offers` | Admin list all promotional offers | Yes | Admin | None | 200, 401, 403 |
| `POST` | `/admin/offers` | Create product or category percentage offer | Yes | Admin | `{ name, targetType, product?, category?, discountPercentage, startDate?, endDate, isActive? }` | 201, 400, 401, 403, 422 |
| `PUT` | `/admin/offers/:id` | Update offer parameters | Yes | Admin | `{ name?, discountPercentage?, startDate?, endDate?, isActive? }` | 200, 400, 401, 403, 404, 422 |
| `DELETE`| `/admin/offers/:id`| Remove promotional offer | Yes | Admin | None | 200, 401, 403, 404 |

### 2.9 Promotional Coupons (`/api/v1/coupons` & `/api/v1/admin/coupons`)
| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/coupons/validate` | Validate coupon against current cart subtotal | Yes | User | `{ code }` | 200, 400, 401, 404, 422 |
| `GET` | `/admin/coupons` | List all coupons with redemptions and caps | Yes | Admin | Query: `isActive?` | 200, 401, 403 |
| `POST` | `/admin/coupons` | Create voucher coupon | Yes | Admin | `{ code, description?, discountType, discountValue, minOrderValue?, maxDiscount?, startDate?, expiryDate, usageLimit?, perUserLimit? }` | 201, 400, 401, 403, 409, 422 |
| `GET` | `/admin/coupons/:id` | Get coupon details | Yes | Admin | None | 200, 401, 403, 404 |
| `PUT` | `/admin/coupons/:id` | Update coupon details and limits | Yes | Admin | `{ description?, discountValue?, minOrderValue?, maxDiscount?, expiryDate?, usageLimit?, perUserLimit?, isActive? }` | 200, 400, 401, 403, 404, 422 |
| `DELETE`| `/admin/coupons/:id`| Delete promotional coupon | Yes | Admin | None | 200, 401, 403, 404 |

### 2.10 Orders & COD Ordering (`/api/v1/orders` & `/api/v1/admin/orders`)
| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/orders/checkout/cod` | Place Cash on Delivery order with stock deduction | Yes | User | `{ addressId, couponCode?, idempotencyKey? }` | 201, 400, 401, 404, 422 |
| `GET` | `/orders` | List customer's personal order history | Yes | User | Query: `page?, limit?` | 200, 401 |
| `GET` | `/orders/:id` | View order snapshot with anti-IDOR protection | Yes | User | None | 200, 401, 404 |
| `POST` | `/orders/:id/cancel` | Cancel order before dispatch with inventory restoration | Yes | User | `{ reason? }` | 200, 400, 401, 404 |
| `GET` | `/admin/orders` | Admin list all orders with filter and search | Yes | Admin | Query: `page?, limit?, status?, search?` | 200, 401, 403 |
| `GET` | `/admin/orders/:id` | Admin inspect order snapshot | Yes | Admin | None | 200, 401, 403, 404 |
| `PATCH` | `/admin/orders/:id/status`| Advance order lifecycle along state machine | Yes | Admin | `{ status, note? }` | 200, 400, 401, 403, 404, 422 |
| `POST` | `/admin/orders/:id/cancel` | Admin cancel order with stock restoration | Yes | Admin | `{ reason? }` | 200, 400, 401, 403, 404 |

### 2.11 Online Payments (`/api/v1/payments`)
| Method | Endpoint | Purpose | Auth | Role | Query / Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/payments/create` | Authoritative calculation, upfront stock decrement, Razorpay order generation | Yes | User | `{ addressId, couponCode?, idempotencyKey? }` | 201, 400, 401, 422 |
| `POST` | `/payments/verify` | Constant-time HMAC-SHA256 signature verification and order confirmation | Yes | User | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | 200, 400, 401, 403, 404, 422 |
| `POST` | `/payments/retry` | Initialize new gateway order for unpaid/failed internal order without rebuilding cart | Yes | User | `{ orderId }` | 200, 400, 401, 404, 422 |
| `POST` | `/payments/webhook`| Public webhook with raw body HMAC verification and x-razorpay-event-id deduplication | No | Public | Raw Body Buffer + Headers `x-razorpay-signature`, `x-razorpay-event-id` | 200, 400 |
| `GET` | `/payments/order/:orderId` | Query payment record by order identifier for status reconciliation | Yes | User | Params: `orderId` | 200, 401, 404 |
| `GET` | `/payments/:id` | Query payment record by payment identifier (Anti-IDOR protected) | Yes | User/Admin | Params: `id` | 200, 401, 403, 404 |

### 2.12 Customer Wallet & Ledger (`/api/v1/wallet`)
| Method | Endpoint | Purpose | Auth | Role | Query / Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/wallet` | Get authenticated user's wallet profile and balance | Yes | User | None | 200, 401 |
| `GET` | `/wallet/transactions` | Get paginated append-only ledger transaction history | Yes | User | Query: `page, limit` | 200, 401 |

### 2.13 Gateway Refunds (`/api/v1/refunds`)
| Method | Endpoint | Purpose | Auth | Role | Query / Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/refunds` | Initiate gateway refund against captured online payment | Yes | User/Admin | `{ orderId, amount?, reason, idempotencyKey? }` | 201, 400, 401, 403, 404 |
| `GET` | `/refunds/order/:orderId` | Get all refunds issued for a specific order | Yes | User/Admin | Params: `orderId` | 200, 401, 403, 404 |
| `GET` | `/admin/refunds` | List all platform refunds with status filter and pagination | Yes | Admin | Query: `page, limit, status, search` | 200, 401, 403 |
| `POST` | `/admin/refunds/order/:orderId/settle` | Settle late-captured CANCELLED order (REFUND_REQUIRED) | Yes | Admin | Params: `orderId` | 200, 400, 401, 403, 404 |

### 2.14 Admin Wallets (`/api/v1/admin/wallets`)
| Method | Endpoint | Purpose | Auth | Role | Query / Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin/wallets/:userId` | View target user's wallet profile and balance | Yes | Admin | Params: `userId` | 200, 401, 403, 404 |
| `POST` | `/admin/wallets/:userId/credit` | Audited manual credit (promotions, goodwill) | Yes | Admin | `{ amount, reason, referenceId? }` | 200, 400, 401, 403, 404 |
| `POST` | `/admin/wallets/:userId/debit` | Audited manual debit (accounting corrections) | Yes | Admin | `{ amount, reason, referenceId? }` | 200, 400, 401, 403, 404 |

### 2.15 Order Returns (`/api/v1/orders`)
| Method | Endpoint | Purpose | Auth | Role | Query / Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/orders/:id/return` | Request return for DELIVERED order within 7-day window | Yes | User | `{ reason }` | 200, 400, 401, 403, 404 |
| `POST` | `/admin/orders/:id/return/review` | Admin review return request (APPROVE or REJECT) | Yes | Admin | `{ decision: "APPROVED"\|"REJECTED", rejectionReason? }` | 200, 400, 401, 403, 404 |

### 2.16 Admin Catalog & Operations (`/api/v1/admin/products`, `/api/v1/categories`, `/api/v1/brands`)
| Method | Endpoint | Purpose | Auth | Role | Request Body / Query | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin/products/all` | List all products including drafts & costPrice | Yes | Admin | `page, limit, search, category, brand` | 200, 401, 403 |
| `POST` | `/admin/products` | Create product with embedded variants | Yes | Admin | `{ name, description, category, brand, variants: [{ sku, price, costPrice, stock, ... }] }` | 201, 400, 401, 403, 409, 422 |
| `GET` | `/admin/products/:id` | Get full product detail including wholesale costPrice | Yes | Admin | None | 200, 401, 403, 404 |
| `PUT` | `/admin/products/:id` | Update product metadata, category, brand, active status | Yes | Admin | `{ name?, description?, category?, brand?, isActive?, tags?, images? }` | 200, 400, 401, 403, 404, 422 |
| `DELETE` | `/admin/products/:id` | Soft/hard delete product from catalog | Yes | Admin | None | 200, 401, 403, 404 |
| `POST` | `/admin/products/:id/variants` | Add new embedded variant to product | Yes | Admin | `{ sku, title, price, costPrice, stock, attributes? }` | 201, 400, 401, 403, 404, 409, 422 |
| `PATCH`/`PUT` | `/admin/products/:id/variants/:variantId` | Update embedded variant & recalculate basePrice | Yes | Admin | `{ title?, price?, costPrice?, stock?, isActive?, attributes? }` | 200, 400, 401, 403, 404, 422 |
| `DELETE` | `/admin/products/:id/variants/:variantId` | Remove variant from product | Yes | Admin | None | 200, 400, 401, 403, 404 |
| `POST` | `/categories` | Create category | Yes | Admin | `{ name, description?, isActive? }` | 201, 400, 401, 403, 409, 422 |
| `PUT` | `/categories/:id` | Update category name, description, active status | Yes | Admin | `{ name?, description?, isActive? }` | 200, 400, 401, 403, 404, 422 |
| `DELETE` | `/categories/:id` | Delete category | Yes | Admin | None | 200, 401, 403, 404 |
| `POST` | `/brands` | Create brand | Yes | Admin | `{ name, description?, logo?, website?, isActive? }` | 201, 400, 401, 403, 409, 422 |
| `PUT` | `/brands/:id` | Update brand details | Yes | Admin | `{ name?, description?, logo?, website?, isActive? }` | 200, 400, 401, 403, 404, 422 |
| `DELETE` | `/brands/:id` | Delete brand | Yes | Admin | None | 200, 401, 403, 404 |
| `GET` | `/admin/dashboard` | Future Metrics: Total revenue, orders, inventory counts | Yes | Admin | None | 200, 403 |

---

## 3. OpenAPI / Swagger & Postman Documentation Plan
1. **Swagger / OpenAPI 3.0**:
   - Implemented via `swagger-jsdoc` and `swagger-ui-express`.
   - Exposed in non-production environments at `/api/v1/docs`.
   - Contains exact JSON schema definitions for request bodies, headers, and standard error responses.
2. **Postman Collection**:
   - Environment variables pre-configured: `{{baseUrl}} = http://localhost:5000/api/v1`.
   - Pre-request script automatically preserves session cookies across test calls.
   - Comprehensive test assertions checking response status (`pm.response.to.have.status(200)`) and envelope structure (`pm.expect(pm.response.json().success).to.be.true`).
