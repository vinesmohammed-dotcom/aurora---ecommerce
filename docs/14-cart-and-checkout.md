# 14 — Cart & Multi-Stage Checkout Engine

## 1. The Core Law of E-Commerce Security: Never Trust the Client
A fundamental security principle in web engineering: **The client (browser) is an untrusted environment.**

Anyone can open Chrome DevTools, modify JavaScript variables, or send custom HTTP payloads using Postman:
- A malicious actor can modify a product's price from ₹4,999 to ₹1 before submitting the checkout form.
- A user could modify their cart quantity to exceed warehouse stock.
- A user could fabricate a 90% discount code that does not exist in the database.

**Therefore, the backend recalculates and verifies every single parameter at the exact millisecond of checkout.** The frontend only sends intent (`items: [{ productId, variantId, quantity }]`, `addressId`, `couponCode`, `useWallet: boolean`).

---

## 2. Multi-Stage Checkout Pipeline

```mermaid
flowchart TD
    Start([User Clicks 'Place Order']) --> Step1[1. Load Active Cart & User]
    Step1 --> Step2[2. Validate Products & Variants Existence]
    Step2 --> Step3{All items active & exist?}
    Step3 -- No --> Err1[Abort: Item no longer available]
    Step3 -- Yes --> Step4[3. Verify Real-Time Stock Availability]
    Step4 --> Step5{Stock >= Requested Qty?}
    Step5 -- No --> Err2[Abort: Insufficient stock for variant]
    Step5 -- Yes --> Step6[4. Fetch Current Base Prices from DB]
    Step6 --> Step7[5. Compute Active Product & Category Offers]
    Step7 --> Step8[6. Validate Coupon Code & Apply Rules]
    Step8 --> Step9[7. Deduct Wallet Balance if selected]
    Step9 --> Step10[8. Add Shipping Fees based on pincode/order]
    Step10 --> Step11[9. Compute Immutable Final Payable Amount]
    Step11 --> Step12{Payment Method?}
    Step12 -- COD --> CODOrder[Create Order: CONFIRMED & Decrement Stock]
    Step12 -- Online (Razorpay) --> RzpOrder[Create Order: PENDING_PAYMENT & Create Razorpay Order]
    Step12 -- Wallet (100%) --> WltOrder[Debit Wallet & Create Order: CONFIRMED]
```

---

## 3. Step-by-Step Calculation Engine Breakdown

### Step 1 & 2: Existence & Active Status Check
- Queries the `Product` collection for every item in the cart.
- Verifies `product.isActive === true` and the parent `Category.isActive === true`.
- Finds the specific variant inside `product.variants` matching `variantId` and checks `variant.isActive === true`.

### Step 3: Atomic Stock Verification
- Ensures `variant.stock >= item.quantity`.
- If insufficient, checkout halts immediately with a clear error payload: `{ code: 'OUT_OF_STOCK', item: variant.sku, available: variant.stock }`.

### Step 4: Fresh Price Extraction
- Ignores whatever price the frontend displayed.
- Extracts `unitPrice = variant.price` directly from the freshly queried MongoDB document.
- Computes `itemSubtotal = unitPrice * item.quantity`.

### Step 5: Automatic Catalog & Category Offers
- Checks the `Offer` collection for active date-valid offers (`startDate <= now <= expiryDate`).
- If an applicable Category or Product offer exists, the discount is applied to the unit price.

### Step 6: Coupon Application & Boundary Enforcement
- Validates the coupon code:
  1. Does the coupon exist and is `isActive === true`?
  2. Is `now` between `startDate` and `expiryDate`?
  3. Has the global `usageLimit` been reached (`usageCount < usageLimit`)?
  4. Has this specific user exceeded their `perUserLimit`?
  5. Is `subtotal >= minOrderValue`?
- **Discount Calculation**:
  - `PERCENTAGE`: `discount = (subtotal * coupon.discountValue) / 100`. If `coupon.maxDiscountCap` is set, `discount = Math.min(discount, coupon.maxDiscountCap)`.
  - `FLAT`: `discount = coupon.discountValue`.
- **Negative Balance Guard**: `discount = Math.min(discount, subtotal)` (a discount can never make an order total negative).

### Step 7: Wallet Balance Deduction
- If the customer checks "Use Wallet Balance":
  - Fetch real-time `wallet.balance`.
  - `walletDeduction = Math.min(wallet.balance, payableAfterDiscount)`.
  - Remaining amount is charged via Online Payment / COD. If `walletDeduction === payableAfterDiscount`, the order is 100% paid by wallet!

### Step 8: Shipping Fee Calculation
- Free shipping threshold applied (e.g. Free shipping on orders over ₹1,000; otherwise flat ₹99 delivery fee).

### Step 9: Final Total Formulation
$$\text{finalPayable} = (\text{subtotal} - \text{offerDiscount} - \text{couponDiscount}) - \text{walletDeduction} + \text{shippingFee}$$
- All arithmetic is executed in integers (paise) or rounded to 2 decimal places to avoid IEEE-754 floating point precision errors (`0.1 + 0.2 = 0.30000000000000004`).

---

## 4. Race Condition & Concurrency Guard
What happens if two users checkout the last remaining item (`stock = 1`) simultaneously?
We use MongoDB's **atomic conditional decrement**:
```javascript
const updatedProduct = await Product.findOneAndUpdate(
  {
    _id: productId,
    "variants._id": variantId,
    "variants.stock": { $gte: quantity } // Atomic filter precondition
  },
  {
    $inc: { "variants.$.stock": -quantity }
  },
  { new: true, session }
);

if (!updatedProduct) {
  throw new AppError("Item ran out of stock during checkout!", 409);
}
```
Only one query will find `{ "variants.stock": { $gte: quantity } }` evaluate to true. The second query will find 0 matching documents and safely fail, preventing negative stock.
