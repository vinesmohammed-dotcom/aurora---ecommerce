# 07 — Database Schema & Data Modeling

## 1. Data Modeling Strategy: Embedded vs Referenced in MongoDB
In MongoDB, a foundational design decision is choosing between **referencing** (normalized relational style using `ObjectId` links) and **embedding** (denormalized nested documents).

### Product & Variant Architectural Decision
- **Architecture Choice**: **Embedded Variant Array** within the `Product` document (`Product.variants: [VariantSchema]`).
- **Why Not a Separate Collection?**:
  1. **Query Performance**: In e-commerce, displaying a product page requires loading its title, description, brand, category, and all available variants (sizes, colors, stock, pricing) simultaneously. Embedding delivers all variant data in a **single indexed query** with zero expensive `$lookup` (JOIN) stages.
  2. **Atomic Stock Decrements**: MongoDB provides document-level ACID atomicity. By embedding variants, we can execute atomic conditional decrements on an exact variant item within the parent document:
     ```javascript
     Product.updateOne(
       { _id: productId, "variants._id": variantId, "variants.stock": { $gte: quantity } },
       { $inc: { "variants.$.stock": -quantity } }
     );
     ```
     This query either succeeds or modifies 0 documents if stock was insufficient, completely preventing race conditions without needing distributed locks!
  3. **Array Limit Safety**: BSON documents have a 16MB limit. A product with 50 variants consumes less than 50KB, well below the limit.
- **Referenced Collections**: Used where data grows unbounded over time or is shared across independent entities: `User`, `Category`, `Brand`, `Order`, `Payment`, `Wallet`, `WalletTransaction`, `AuditLog`.

---

## 2. Collection Schemas

### 2.1 User Collection (`backend/src/modules/users/user.model.js`)
- **Purpose**: Stores customer and administrative credentials, profile information, and account status.
- **Fields**:
  - `_id`: `ObjectId`, required (Primary Key).
  - `name`: `String`, required, trimmed, min 2, max 50 chars.
  - `email`: `String`, required, unique, lowercase, trimmed, valid email format.
  - `passwordHash`: `String`, required, select: false (hashed using `bcryptjs` with 12 salt rounds).
  - `phone`: `String`, optional, trimmed.
  - `role`: `String`, required, enum: `['USER', 'ADMIN']`, default: `'USER'`, indexed.
  - `isVerified`: `Boolean`, default: `false` (set to `true` upon successful registration OTP entry).
  - `isBlocked`: `Boolean`, default: `false` (admin can toggle to suspend malicious accounts).
  - `createdAt`, `updatedAt`: `Date`, timestamps.
- **Methods**:
  - `comparePassword(candidatePassword)`: Compares candidate plaintext with `passwordHash` via `bcrypt.compare`.
  - `toJSON()`: Explicitly deletes `passwordHash` and `__v` before returning serialized JSON to clients.
- **Indexes**:
  - Unique index: `{ email: 1 }` (enforced via `unique: true`)
  - Index: `{ role: 1 }`

### 2.2 OTP Collection (`backend/src/modules/auth/otp.model.js`)
- **Purpose**: Stores time-sensitive, one-time passwords for registration verification, password resets, and email changes.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `email`: `String`, required, lowercase, trimmed.
  - `hashedOtp`: `String`, required (Server-secret keyed HMAC-SHA256 digest of `OTP:purpose:email`; plaintext is never stored and offline dictionary/rainbow table attacks against 6-digit codes are rendered computationally infeasible without the server secret).
  - `purpose`: `String`, required, enum: `['REGISTRATION', 'PASSWORD_RESET', 'EMAIL_CHANGE']`.
  - `expiresAt`: `Date`, required, 5-minute TTL from creation.
  - `attempts`: `Number`, default: `0` (tracks failed verification attempts).
  - `maxAttempts`: `Number`, default: `5` (locks token after 5 failed guesses).
  - `isUsed`: `Boolean`, default: `false` (prevents replay/reuse attacks).
  - `createdAt`, `updatedAt`: `Date`, timestamps.
- **Methods**:
  - `hashOtp(plainOtp, { purpose, email })`: Generates `crypto.createHmac("sha256", env.OTP_SECRET).update(`${plainOtp}:${purpose}:${email}`).digest("hex")`.
  - `verifyOtp(candidateOtp)`: Performs timing-safe comparison `crypto.timingSafeEqual(...)` against candidate digest.
- **Indexes**:
  - TTL Index: `{ expiresAt: 1 }, { expireAfterSeconds: 0 }` (MongoDB auto-deletes expired records).
  - Compound Index: `{ email: 1, purpose: 1 }` (accelerates looking up active verification tokens).

### 2.3 Category Collection (`backend/src/modules/categories/category.model.js`)
- **Purpose**: High-level classification of catalog products (e.g. Footwear, Apparel, Electronics).
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `name`: `String`, required, unique, trimmed, min 2, max 50 chars.
  - `slug`: `String`, required, unique, lowercase (URL-friendly slug).
  - `description`: `String`, optional, max 500 chars.
  - `image`: `String`, optional (AWS S3 URL).
  - `isActive`: `Boolean`, default: `true` (disabling a category hides its products from public shop queries).
  - `createdAt`, `updatedAt`: `Date`, timestamps.
- **Indexes**:
  - Unique index: `{ slug: 1 }`
  - Index: `{ isActive: 1 }`

### 2.4 Brand Collection (`backend/src/modules/brands/brand.model.js`)
- **Purpose**: Manufacturer or brand classification (e.g. Nike, Adidas, Puma).
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `name`: `String`, required, unique, trimmed, min 2, max 50 chars.
  - `slug`: `String`, required, unique, lowercase.
  - `logo`: `String`, optional (AWS S3 URL).
  - `website`: `String`, optional.
  - `description`: `String`, optional, max 500 chars.
  - `isActive`: `Boolean`, default: `true`.
  - `createdAt`, `updatedAt`: `Date`, timestamps.
- **Indexes**:
  - Unique index: `{ slug: 1 }`
  - Index: `{ isActive: 1 }`

### 2.5 Product Collection (with Embedded Variants) (`backend/src/modules/products/product.model.js`)
- **Purpose**: Complete catalog product definition, media assets, and embedded variant stock matrices.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `name`: `String`, required, trimmed, min 2, max 120 chars (standardized model field, with virtual `title` getter/setter for backwards compatibility).
  - `slug`: `String`, required, unique, lowercase, trimmed.
  - `description`: `String`, required, min 10 chars, max 2000 chars.
  - `category`: `ObjectId`, ref: `'Category'`, required, indexed.
  - `brand`: `ObjectId`, ref: `'Brand'`, required, indexed.
  - `images`: `[String]`, array of image URLs (min 1, max 6).
  - `tags`: `[String]`, array of lowercase search tags.
  - `basePrice`: `Number`, required, min 0 (automatically computed from lowest active variant price).
  - `isActive`: `Boolean`, default: `true`, indexed.
  - `isFeatured`: `Boolean`, default: `false`.
  - `variants`: Array of Subdocuments (`variantSchema`, min 1 required):
    - `_id`: `ObjectId`, required (Variant ID).
    - `sku`: `String`, required, uppercase, trimmed (dual uniqueness protection: sparse unique index across products + application-level validation within product).
    - `attributes`: `Map of String` (e.g. `color: "Navy", size: "10"`).
    - `price`: `Number`, required, min 1 (customer retail selling price).
    - `costPrice`: `Number`, required, min 0 (merchant wholesale cost price; **strictly excluded from customer endpoints via `select('-variants.costPrice')`**).
    - `stock`: `Number`, required, min 0, integer (warehouse physical inventory).
    - `isActive`: `Boolean`, default: `true`.
  - `createdAt`, `updatedAt`: `Date`, timestamps.
- **Indexes**:
  - Compound Index (ESR): `{ isActive: 1, basePrice: 1, createdAt: -1 }`
  - Compound Index (Category ESR): `{ category: 1, isActive: 1, basePrice: 1 }`
  - Compound Index (Brand ESR): `{ brand: 1, isActive: 1, basePrice: 1 }`
  - Unique Sparse Index: `{ "variants.sku": 1 }, { unique: true, sparse: true }`
  - Text Index: `{ name: "text", description: "text", tags: "text" }`
- **Data Protection Guarantee**: Public endpoints (`GET /api/v1/products` and `GET /api/v1/products/:slug`) strictly project away `costPrice` using `.select('-variants.costPrice')`. Admin endpoints (`GET /api/v1/admin/products/:id`) provide full margin transparency to authorized administrators.

### 2.6 Cart Collection (`backend/src/modules/cart/cart.model.js`)
- **Purpose**: Persistent shopping cart for authenticated users.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `userId`: `ObjectId`, ref: `'User'`, required, unique (one active cart document per customer).
  - `items`: Array of Subdocuments (`cartItemSchema`):
    - `productId`: `ObjectId`, ref: `'Product'`, required.
    - `variantId`: `ObjectId`, required.
    - `quantity`: `Number`, required, min 1, max 10 (strict per-item limit).
  - `createdAt`, `updatedAt`: `Date`, timestamps.
- **Dynamic Pricing Architectural Principle**: Cart prices, item subtotals, and overall order totals are **never** stored statically in the database. When a customer retrieves their cart, prices, variant attributes, active statuses, and stock levels are dynamically populated directly from current `Product` variants. This prevents client price tampering and guarantees stale inventory drift detection.
- **Indexes**:
  - Unique Index: `{ userId: 1 }`

### 2.7 Wishlist Collection (`backend/src/modules/wishlist/wishlist.model.js`)
- **Purpose**: Saved customer favorite items for tracking and fast future checkout.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `userId`: `ObjectId`, ref: `'User'`, required, unique (one wishlist per customer).
  - `items`: `[{ type: ObjectId, ref: 'Product' }]` (set uniqueness enforced via MongoDB `$addToSet`).
  - `createdAt`, `updatedAt`: `Date`, timestamps.
- **Indexes**:
  - Unique Index: `{ userId: 1 }`

### 2.8 Address Collection (`backend/src/modules/addresses/address.model.js`)
- **Purpose**: Multi-line shipping destinations linked strictly to authenticated customer profiles.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `userId`: `ObjectId`, ref: `'User'`, required, indexed.
  - `fullName`: `String`, required, trimmed, min 2, max 100 chars.
  - `phone`: `String`, required, trimmed, 10 to 15 digits/symbols.
  - `addressLine1`: `String`, required, trimmed, min 3, max 200 chars.
  - `addressLine2`: `String`, trimmed, optional, default: `""`.
  - `city`: `String`, required, trimmed, min 2, max 100 chars.
  - `state`: `String`, required, trimmed, min 2, max 100 chars.
  - `postalCode`: `String`, required, trimmed, min 3, max 20 chars.
  - `country`: `String`, required, trimmed, default: `"India"`.
  - `label`: `String`, required, enum: `['HOME', 'WORK', 'OTHER']`, default: `'HOME'`.
  - `isDefault`: `Boolean`, default: `false`.
  - `createdAt`, `updatedAt`: `Date`, timestamps.
- **Indexes**:
  - Compound Index: `{ userId: 1, isDefault: -1 }` (optimizes default address lookup and list ordering).
- **Single Default Rule**: When an address is created or flagged as default, all other addresses belonging to `userId` have `isDefault` atomically reset to `false`. When a default address is deleted, the customer's most recently updated remaining address is automatically promoted to default.
- **Anti-IDOR Security**: All address operations filter strictly by `{ _id, userId: req.user._id }`. Queries attempting to access other users' addresses return `404 NOT_FOUND` rather than `403 FORBIDDEN` to prevent ID enumeration.

### 2.9 Coupon Collection
- **Purpose**: Admin-created promotional codes applied at checkout.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `code`: `String`, required, unique, uppercase, trimmed (e.g. `SAVE20`).
  - `discountType`: `String`, required, enum: `['PERCENTAGE', 'FLAT']`.
  - `discountValue`: `Number`, required, min 1.
  - `minOrderValue`: `Number`, required, default: 0.
  - `maxDiscountCap`: `Number`, optional (caps maximum deduction for percentage coupons).
  - `startDate`: `Date`, required.
  - `expiryDate`: `Date`, required.
  - `usageLimit`: `Number`, required (global maximum times coupon can be used).
  - `usageCount`: `Number`, default: 0.
  - `perUserLimit`: `Number`, default: 1.
  - `usedBy`: Array of `{ user: ObjectId, count: Number }`.
  - `isActive`: `Boolean`, default: `true`.
- **Indexes**:
  - Unique index: `{ code: 1 }`
  - Index: `{ isActive: 1, expiryDate: 1 }`

### 2.10 Offer Collection
- **Purpose**: Automatic catalog-wide or category-wide promotional discounts.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `title`: `String`, required (e.g. "Diwali Shoe Fest").
  - `discountPercentage`: `Number`, required, min 1, max 90.
  - `offerType`: `String`, required, enum: `['CATEGORY', 'PRODUCT']`.
  - `category`: `ObjectId`, ref: `'Category'`, optional.
  - `product`: `ObjectId`, ref: `'Product'`, optional.
  - `startDate`: `Date`, required.
  - `expiryDate`: `Date`, required.
  - `isActive`: `Boolean`, default: `true`.

### 2.11 Order Collection (Historical Snapshot Model)
- **Purpose**: Immutable financial and fulfillment record of a completed checkout.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `orderNumber`: `String`, required, unique (e.g. `ORD-2026-98124`).
  - `user`: `ObjectId`, ref: `'User'`, required.
  - `items`: Array of Immutable Snapshots:
    - `product`: `ObjectId`, ref: `'Product'`, required (historical link).
    - `productName`: `String`, required (frozen name).
    - `variantId`: `ObjectId`, required.
    - `sku`: `String`, required (frozen SKU).
    - `attributes`: `Map` of strings (frozen size/color).
    - `price`: `Number`, required (frozen unit selling price).
    - `quantity`: `Number`, required.
    - `subtotal`: `Number`, required (`price * quantity`).
  - `shippingAddress`: Immutable Subdocument (fullName, phone, street, city, state, pincode).
  - `pricing`:
    - `itemsSubtotal`: `Number`, required.
    - `discountAmount`: `Number`, default: 0.
    - `couponCode`: `String`, optional.
    - `walletDeduction`: `Number`, default: 0.
    - `shippingFee`: `Number`, default: 0.
    - `finalPayable`: `Number`, required.
  - `paymentMethod`: `String`, required, enum: `['COD', 'ONLINE_RAZORPAY', 'WALLET']`.
  - `paymentStatus`: `String`, required, enum: `['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']`.
  - `orderStatus`: `String`, required, enum: `['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED']`.
  - `cancellationReason`: `String`, optional.
  - `returnReason`: `String`, optional.
  - `deliveredAt`: `Date`, optional.
  - `invoiceUrl`: `String`, optional (AWS S3 URL to generated PDF).
  - `createdAt`, `updatedAt`: `Date`.
- **Indexes**:
  - Unique index: `{ orderNumber: 1 }`
  - Compound Index: `{ user: 1, createdAt: -1 }`
  - Index: `{ orderStatus: 1 }`

### 2.12 Payment Collection
- **Purpose**: Auditable record of gateway payment transactions and verification signatures.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `order`: `ObjectId`, ref: `'Order'`, required.
  - `user`: `ObjectId`, ref: `'User'`, required.
  - `gateway`: `String`, required, default: `'RAZORPAY'`.
  - `razorpayOrderId`: `String`, required, unique.
  - `razorpayPaymentId`: `String`, optional.
  - `razorpaySignature`: `String`, optional.
  - `amount`: `Number`, required (in Paise / INR).
  - `status`: `String`, required, enum: `['CREATED', 'SUCCESS', 'FAILED']`.
  - `failureReason`: `String`, optional.
  - `webhookReceived`: `Boolean`, default: `false`.
  - `createdAt`, `updatedAt`: `Date`.
- **Indexes**:
  - Unique index: `{ razorpayOrderId: 1 }`
  - Index: `{ order: 1 }`

### 2.13 Wallet & WalletTransaction Collections
- **Purpose**: Stored customer monetary credits and immutable double-entry ledger.
- **Wallet Schema**:
  - `_id`: `ObjectId`, required.
  - `user`: `ObjectId`, ref: `'User'`, required, unique.
  - `balance`: `Number`, required, default: 0, min: 0.
  - `updatedAt`: `Date`.
- **WalletTransaction Schema**:
  - `_id`: `ObjectId`, required.
  - `wallet`: `ObjectId`, ref: `'Wallet'`, required.
  - `amount`: `Number`, required, min: 1.
  - `type`: `String`, required, enum: `['CREDIT', 'DEBIT', 'REFUND', 'PROMOTIONAL_CREDIT']`.
  - `order`: `ObjectId`, ref: `'Order'`, optional.
  - `description`: `String`, required.
  - `balanceAfter`: `Number`, required.
  - `createdAt`: `Date`, default: `Date.now`.
- **Indexes**:
  - Index: `{ wallet: 1, createdAt: -1 }`

### 2.14 AuditLog Collection
- **Purpose**: Administrative audit trail tracking sensitive modifications.
- **Fields**:
  - `_id`: `ObjectId`, required.
  - `admin`: `ObjectId`, ref: `'User'`, required.
  - `action`: `String`, required (e.g. `'UPDATE_PRODUCT_PRICE'`, `'BLOCK_USER'`).
  - `targetModel`: `String`, required.
  - `targetId`: `ObjectId`, required.
  - `details`: `Object`, optional (stores diff of old vs new values).
  - `ipAddress`: `String`, optional.
  - `createdAt`: `Date`, default: `Date.now`.
- **Indexes**:
  - Index: `{ targetModel: 1, targetId: 1 }`
  - Index: `{ createdAt: -1 }`
