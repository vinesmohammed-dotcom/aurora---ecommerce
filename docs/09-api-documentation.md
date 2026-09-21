# 09 — REST API Endpoint Specification & Documentation Plan

## 1. RESTful Standards & Versioning
All API endpoints follow strict REST conventions and are versioned under `/api/v1`. Correct semantic HTTP verbs (`GET`, `POST`, `PATCH`, `DELETE`) are strictly enforced. Responses follow the unified schema detailed in [10-api-response-standard.md](file:///c:/Users/vines/react%20first%20project/docs/10-api-response-standard.md).

---

## 2. API Endpoint Catalog

### 2.1 Authentication (`/api/v1/auth`)
| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/register` | Register new customer & send OTP | No | Public | `{ name, email, password, phone }` | 201, 400, 409 |
| `POST` | `/verify-otp` | Verify email OTP & establish session | No | Public | `{ email, otp }` | 200, 400, 404 |
| `POST` | `/resend-otp` | Re-dispatch fresh 6-digit OTP | No | Public | `{ email, purpose }` | 200, 429 |
| `POST` | `/login` | Authenticate customer & set session cookie | No | Public | `{ email, password }` | 200, 400, 401, 403 |
| `POST` | `/logout` | Destroy session & clear cookie | Yes | User/Admin | None | 200, 401 |
| `POST` | `/forgot-password` | Request password reset OTP | No | Public | `{ email }` | 200, 404 |
| `POST` | `/reset-password` | Reset password using OTP | No | Public | `{ email, otp, newPassword }` | 200, 400 |

### 2.2 Customer Account & Addresses (`/api/v1/users`)
| Method | Endpoint | Purpose | Auth | Role | Request Body / Params | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/profile` | Get current user profile | Yes | User/Admin | None | 200, 401 |
| `PATCH` | `/profile` | Update profile info (name, phone) | Yes | User | `{ name, phone }` | 200, 400 |
| `PATCH` | `/change-password` | Update account password | Yes | User | `{ oldPassword, newPassword }` | 200, 400, 401 |
| `GET` | `/addresses` | List all saved addresses | Yes | User | None | 200, 401 |
| `POST` | `/addresses` | Add new shipping address | Yes | User | `{ fullName, phone, street, city, state, pincode, isDefault }` | 201, 400 |
| `PATCH` | `/addresses/:id` | Edit existing address | Yes | User | Partial address fields | 200, 400, 404 |
| `DELETE`| `/addresses/:id` | Delete saved address | Yes | User | None | 200, 404 |

### 2.3 Catalog Browsing (`/api/v1/products`, `/api/v1/categories`, `/api/v1/brands`)
| Method | Endpoint | Purpose | Auth | Role | Query Params | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/products` | List active products with filters & pagination | No | Public | `page, limit, category, brand, minPrice, maxPrice, sort, search` | 200 |
| `GET` | `/products/:slug` | Get full product detail with variants | No | Public | None | 200, 404 |
| `GET` | `/categories` | List all active categories | No | Public | None | 200 |
| `GET` | `/brands` | List all active brands | No | Public | None | 200 |

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

### 2.8 Admin Management (`/api/v1/admin`)
| Method | Endpoint | Purpose | Auth | Role | Request Body | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/dashboard` | Metrics: Total revenue, orders, low stock | Yes | Admin | None | 200, 403 |
| `POST` | `/products` | Create product with variants & upload images | Yes | Admin | Multipart form data | 201, 400 |
| `PATCH` | `/products/:id` | Update product attributes, status, prices | Yes | Admin | Partial product data | 200, 400 |
| `PATCH` | `/products/:id/variants/:varId/stock` | Adjust warehouse inventory | Yes | Admin | `{ stockAdjustment }` | 200, 400 |
| `GET` | `/orders` | List all platform orders with status filters | Yes | Admin | `status, page, limit` | 200 |
| `PATCH` | `/orders/:id/status` | Update lifecycle state (`SHIPPED`, etc.) | Yes | Admin | `{ status, trackingNumber }` | 200, 400 |
| `PATCH` | `/orders/:id/return-review`| Approve or reject customer return request | Yes | Admin | `{ status: 'APPROVED' \| 'REJECTED', reason }` | 200, 400 |
| `POST` | `/coupons` | Create promotional coupon code | Yes | Admin | Coupon schema body | 201, 400 |
| `GET` | `/reports/sales` | Generate sales report with date filter | Yes | Admin | `startDate, endDate, format: 'json' \| 'csv' \| 'pdf'` | 200 |

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
