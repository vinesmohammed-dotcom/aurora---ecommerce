# 12 — Role-Based Authorization & Access Control (RBAC)

## 1. Authentication vs Authorization: The Critical Distinction

```
+-----------------------------------------------------------------------------+
| AUTHENTICATION ("Who are you?")                                             |
| - Verifying the identity of the user.                                       |
| - Verified via session cookie (`connect.sid`) pointing to MongoDB session.   |
| - Result: We know this request belongs to User ID 64f1b... (John Doe).       |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| AUTHORIZATION ("What are you allowed to do?")                               |
| - Verifying whether the authenticated user has permission to access a       |
|   specific resource or perform a specific operation.                        |
| - Example: Regular customer (USER) cannot access /api/v1/admin/* endpoints.  |
| - Example: User cannot update another customer's profile or addresses.     |
+-----------------------------------------------------------------------------+
```

---

## 2. Implemented Middleware Architecture (`backend/src/middlewares/auth.middleware.js`)

### 2.1 `requireAuth` Middleware
Enforces active session presence, loads the current user from MongoDB, checks account status, and attaches the sanitized user object to `req.user`:
```javascript
const requireAuth = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return next(new AppError('Authentication required. Please log in.', 401, 'UNAUTHORIZED'));
  }

  const user = await User.findById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return next(new AppError('User session is invalid or user no longer exists.', 401, 'UNAUTHORIZED'));
  }

  if (user.isBlocked) {
    req.session.destroy(() => {});
    return next(new AppError('Your account has been suspended. Please contact support.', 403, 'FORBIDDEN'));
  }

  req.user = user;
  next();
};
```

**Key Security Characteristics**:
1. **Immediate Revocation**: If an administrator sets `isBlocked: true` in the database, the user is immediately rejected on their next HTTP call; they are not allowed to use their active session.
2. **Context Attachment**: `req.user` is available to all subsequent middlewares and controllers, eliminating duplicate database lookups.

---

### 2.2 `requireRole(...roles)` Middleware (RBAC)
Enforces granular role-based permissions (e.g. `'ADMIN'`):
```javascript
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN'));
    }

    next();
  };
};
```

---

## 3. IDOR Prevention & Scoped Identity Guard

**Insecure Direct Object References (IDOR)** occur when an application relies on client-supplied identifiers (such as `/api/v1/addresses/:id` or `/api/v1/users/:id`) to retrieve or update private records without verifying ownership.

### Architecture Enforcements:
1. **Implicit Session Scoping**:
   - Cart (`/api/v1/cart`) and Wishlist (`/api/v1/wishlist`) take zero user IDs in route parameters or request bodies.
   - Operations strictly query `{ userId: req.user._id }`.
2. **Explicit Compound Ownership Queries for Sub-Entities**:
   - For entity-specific operations like addresses (`GET /api/v1/addresses/:id`, `PUT /api/v1/addresses/:id`, `DELETE /api/v1/addresses/:id`), the database query is always scoped to both `_id` AND `userId`:
     ```javascript
     const address = await Address.findOne({ _id: id, userId: req.user._id });
     if (!address) {
       throw new AppError("Address not found.", 404, "NOT_FOUND");
     }
     ```
3. **The 404 vs 403 Security Strategy (Preventing Resource Enumeration)**:
   - If User B attempts to access User A's address ID `64f1a2b3...`, returning `403 Forbidden` reveals to the attacker that the resource **actually exists** in the system (acting as an enumeration oracle).
   - By returning `404 NOT_FOUND`, User B learns nothing about whether the ID belongs to another customer or is completely invalid. The attack surface is completely neutralized.

---

## 4. Route Protection Matrix

| Route Pattern | Method | Minimum Access | Middleware Stack |
| :--- | :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Public | None (Liveness probe) |
| `/api/v1/health/ready` | `GET` | Public | None (Readiness probe) |
| `/api/v1/auth/register` | `POST` | Public | `validate(registerSchema)`, `authLimiter` |
| `/api/v1/auth/login` | `POST` | Public | `validate(loginSchema)`, `authLimiter` |
| `/api/v1/auth/me` | `GET` | Authenticated | `requireAuth` |
| `/api/v1/auth/logout` | `POST` | Authenticated | `requireAuth` |
| `/api/v1/auth/change-password` | `PUT` | Authenticated | `requireAuth`, `validate(changePasswordSchema)` |
| `/api/v1/auth/request-email-change` | `POST` | Authenticated | `requireAuth`, `otpLimiter`, `validate(...)` |
| `/api/v1/users/profile` | `GET` | Authenticated | `requireAuth` |
| `/api/v1/users/profile` | `PUT` | Authenticated | `requireAuth`, `validate(updateProfileSchema)` |
| `/api/v1/addresses` | `GET`, `POST` | Authenticated | `requireAuth`, `validate(createAddressSchema)` |
| `/api/v1/addresses/:id` | `GET`, `PUT`, `DELETE` | Authenticated Owner | `requireAuth`, `validate(addressIdParamSchema)` |
| `/api/v1/addresses/:id/default` | `PATCH` | Authenticated Owner | `requireAuth`, `validate(addressIdParamSchema)` |
| `/api/v1/cart` | `GET`, `DELETE` | Authenticated | `requireAuth` |
| `/api/v1/cart/items` | `POST` | Authenticated | `requireAuth`, `validate(addToCartSchema)` |
| `/api/v1/cart/items/:variantId` | `PATCH`, `DELETE` | Authenticated | `requireAuth`, `validate(variantIdParamSchema)` |
| `/api/v1/wishlist` | `GET` | Authenticated | `requireAuth` |
| `/api/v1/wishlist/items` | `POST` | Authenticated | `requireAuth`, `validate(addToWishlistSchema)` |
| `/api/v1/wishlist/items/:productId` | `DELETE` | Authenticated | `requireAuth`, `validate(productIdParamSchema)` |
| `/api/v1/wishlist/toggle` | `POST` | Authenticated | `requireAuth`, `validate(addToWishlistSchema)` |
| `/api/v1/admin/**` | ALL | Admin Only | `requireAuth`, `requireRole('ADMIN')` |
