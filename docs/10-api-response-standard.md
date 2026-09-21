# 10 — API Response Envelope & Error Format Standards

## 1. The Standardized API Envelope Principle
In professional web engineering, inconsistent API responses (e.g. sometimes returning raw arrays, sometimes `{ result: ... }`, sometimes plain text) force frontend engineers to write defensive, fragile parsing code.

This project guarantees **100% predictable JSON structures** across all endpoints. Every response is guaranteed to contain a top-level `success: Boolean` flag.

---

## 2. Standard Success Response Envelope

```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {
    "_id": "64f1a8c9b4e1a2001c9a1234",
    "name": "Nike Air Max 90",
    "slug": "nike-air-max-90",
    "basePrice": 4999,
    "variants": [
      {
        "_id": "64f1a8c9b4e1a2001c9a5678",
        "sku": "NK-AIR90-WHT-09",
        "price": 4999,
        "stock": 14
      }
    ]
  },
  "meta": {}
}
```

### Response Helper Class (`utils/ApiResponse.js`)
```javascript
class ApiResponse {
  constructor(statusCode, data, message = "Success", meta = {}) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }

  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
      meta: this.meta
    });
  }
}

module.exports = ApiResponse;
```

---

## 3. Standard Paginated Response Envelope

For collections and search listings, the `meta` object contains standard pagination controls:

```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    { "_id": "...", "name": "Item 1" },
    { "_id": "...", "name": "Item 2" }
  ],
  "meta": {
    "pagination": {
      "currentPage": 1,
      "limit": 12,
      "totalItems": 48,
      "totalPages": 4,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## 4. Standard Error Response Envelope

When an error occurs (validation, authentication, business invariant violation), the response returns an HTTP 4xx or 5xx code with a structured error envelope:

```json
{
  "success": false,
  "message": "Validation failed on submitted fields",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address"
    },
    {
      "field": "password",
      "message": "Password must contain at least 8 characters"
    }
  ]
}
```

### Standard Machine-Readable Error Codes (`constants/errorCodes.js`)
- `VALIDATION_ERROR`: Zod schema validation failed on body/params.
- `UNAUTHORIZED`: No active session found or invalid credentials.
- `FORBIDDEN`: Role lacks permission for this action.
- `NOT_FOUND`: Requested entity does not exist.
- `OUT_OF_STOCK`: Warehouse inventory insufficient for requested quantity.
- `COUPON_INVALID`: Coupon expired, quota reached, or cart minimum unmet.
- `PAYMENT_VERIFICATION_FAILED`: Razorpay HMAC signature mismatch.
- `INTERNAL_SERVER_ERROR`: Unhandled exception (sanitized in production).
