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

### 2.4 Cart & Wishlist (`/api/v1/cart`, `/api/v1/wishlist`)
| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/cart` | Get populated cart with live prices & stock | Yes | User | None | 200, 401 |
| `POST` | `/cart/items` | Add product variant to cart | Yes | User | `{ productId, variantId, quantity }` | 200, 400, 409 |
| `PATCH` | `/cart/items/:variantId` | Update item quantity in cart | Yes | User | `{ quantity }` | 200, 400, 409 |
| `DELETE`| `/cart/items/:variantId` | Remove item from cart | Yes | User | None | 200 |
| `GET` | `/wishlist` | View user's wishlist | Yes | User | None | 200 |
| `POST` | `/wishlist/toggle`| Add or remove product from wishlist | Yes | User | `{ productId }` | 200 |

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
| `POST` | `/retry` | Generate fresh Razorpay order for failed order | Yes | User | `{ orderId }` | 200, 400 |
| `POST` | `/webhook` | Asynchronous Razorpay webhook ingestion | No | Gateway | Headers: `x-razorpay-signature`, Body: Webhook payload | 200, 400 |

### 2.7 Wallet (`/api/v1/wallet`)
| Method | Endpoint | Purpose | Auth | Role | Query / Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Get current balance and recent transactions | Yes | User | `page, limit` | 200 |

### 2.8 Admin Catalog & Operations (`/api/v1/admin/products`, `/api/v1/categories`, `/api/v1/brands`)
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
