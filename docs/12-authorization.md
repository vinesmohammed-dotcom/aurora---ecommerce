# 12 — Role-Based Authorization & Access Control (RBAC)

## 1. Authentication vs Authorization: The Critical Distinction

```
+-----------------------------------------------------------------------------+
| AUTHENTICATION ("Who are you?")                                             |
| - Verifying the identity of the user.                                       |
| - Example: Verifying email + password or validating the session cookie.     |
| - Result: We know this client belongs to User ID 64f1b... (John Doe).       |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| AUTHORIZATION ("What are you allowed to do?")                               |
| - Verifying whether the authenticated user has permission to access a       |
|   specific resource or perform a specific operation.                        |
| - Example: John Doe (USER) cannot access /api/v1/admin/sales-report.        |
| - Example: John Doe cannot view Jane Smith's orders (/orders/:id).          |
+-----------------------------------------------------------------------------+
```

---

## 2. Middleware Architecture & Implementation

### 2.1 `isAuthenticated` Middleware
Verifies that an active, valid session exists in MongoDB:
```javascript
const isAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      message: "Please log in to access this resource."
    });
  }
  next();
};
```

### 2.2 `authorizeRoles` Middleware (RBAC)
Enforces granular role requirements (e.g. `'ADMIN'`):
```javascript
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action."
      });
    }
    next();
  };
};
```

### 2.3 Resource Ownership Guard (`isOwner`)
Prevents IDOR (Insecure Direct Object References). A regular customer must never be able to inspect another customer's order by changing the URL parameter:
```javascript
const isOrderOwner = async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  // Admin can view any order; regular user can only view their own
  if (req.session.role !== "ADMIN" && order.user.toString() !== req.session.userId.toString()) {
    return res.status(403).json({
      success: false,
      code: "FORBIDDEN",
      message: "Access denied to this order."
    });
  }
  
  req.order = order; // Pass down to controller
  next();
};
```

---

## 3. Route Protection Matrix

| Route Pattern | Method | Access Level | Middleware Stack |
| :--- | :--- | :--- | :--- |
| `/api/v1/products` | `GET` | **Public** | None |
| `/api/v1/products/:id` | `GET` | **Public** | None |
| `/api/v1/auth/register` | `POST` | **Public** | `rateLimiter` |
| `/api/v1/cart/**` | ALL | **Customer** | `isAuthenticated` |
| `/api/v1/orders/checkout` | `POST` | **Customer** | `isAuthenticated`, `validateCheckout` |
| `/api/v1/orders/my-orders` | `GET` | **Customer** | `isAuthenticated` |
| `/api/v1/orders/:id` | `GET` | **Customer / Admin** | `isAuthenticated`, `isOrderOwner` |
| `/api/v1/wallet/**` | ALL | **Customer** | `isAuthenticated` |
| `/api/v1/admin/products` | `POST` | **Admin Only** | `isAuthenticated`, `authorizeRoles('ADMIN')`, `upload.array('images')` |
| `/api/v1/admin/orders/:id/status`| `PATCH` | **Admin Only** | `isAuthenticated`, `authorizeRoles('ADMIN')` |
| `/api/v1/admin/reports/**` | `GET` | **Admin Only** | `isAuthenticated`, `authorizeRoles('ADMIN')` |
| `/api/v1/admin/users/:id/block` | `PATCH` | **Admin Only** | `isAuthenticated`, `authorizeRoles('ADMIN')` |
