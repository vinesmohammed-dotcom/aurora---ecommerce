# 13 — Razorpay Payment Architecture & Webhook Synchronization

## 1. High-Level Gateway Architecture
Payment integration is the most high-risk component of any commercial platform. A single security flaw can result in inventory theft or financial fraud.

### The Golden Rule of Payment Security
> **The frontend client must NEVER know the payment secret, and must NEVER specify the payment amount to Razorpay.**
> - The backend calculates the exact amount from verified database prices.
> - The backend issues an authenticated `orders.create` API call directly to Razorpay.
> - Razorpay returns a `razorpay_order_id`, which the frontend uses solely to open the visual checkout modal.
> - A payment is **NEVER** marked successful based on client callback claims alone. The backend must mathematically verify the HMAC SHA-256 signature or receive a verified webhook event before fulfilling the order.

---

## 2. End-to-End Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Browser)
    participant React as React Frontend
    participant Server as Express API (/api/v1/payments)
    participant Razorpay as Razorpay Gateway Server
    participant DB as MongoDB Atlas

    Customer->>React: Click "Proceed to Online Payment"
    React->>Server: POST /api/v1/orders/checkout { cart, addressId, coupon }
    Note over Server: 1. Calculate price from DB<br/>2. Apply coupons/wallet<br/>3. Create DB Order (PENDING_PAYMENT)
    Server->>Razorpay: razorpay.orders.create({ amount: finalAmountPaise, currency: "INR", receipt: orderId })
    Razorpay-->>Server: Return { id: "order_K7x9Z..." }
    Server->>DB: Save Payment doc { razorpayOrderId: "order_K7x9Z...", status: "CREATED" }
    Server-->>React: Return { orderId, razorpayOrderId, razorpayKeyId }

    React->>Customer: Launch Razorpay Modal (Checkout.js)
    Customer->>Razorpay: Enters UPI / Card details and completes 3D-Secure OTP
    
    alt Synchronous Success (Normal Path)
        Razorpay-->>React: Return { razorpay_order_id, razorpay_payment_id, razorpay_signature }
        React->>Server: POST /api/v1/payments/verify-signature { ...payload }
        Note over Server: Compute HMAC SHA-256:<br/>crypto.createHmac('sha256', KEY_SECRET)<br/>.update(order_id + "|" + payment_id)<br/>.digest('hex') === signature
        alt Signature Matches
            Server->>DB: Update Payment (SUCCESS) & Order (CONFIRMED)<br/>Atomic Stock Decrement
            Server-->>React: 200 OK { success: true, redirect: "/order-success" }
            React->>Customer: Render "Order Confirmed" screen
        else Signature Mismatch
            Server-->>React: 400 Bad Request (Tampered Payment Data)
        end
    else User Closes Tab / Drops Connection
        Note over Customer,Razorpay: Customer's bank debited, but browser tab was closed before verify-signature reached server!
    end

    Note over Razorpay,Server: Asynchronous Safety Net (Webhooks):
    Razorpay-)Server: POST /api/v1/payments/webhook [Event: payment.captured]
    Note over Server: 1. Verify X-Razorpay-Signature with WEBHOOK_SECRET<br/>2. Idempotency Check: If order is already CONFIRMED, return 200 OK immediately.<br/>3. If order is still PENDING_PAYMENT, update to CONFIRMED and decrement stock!
    Server--)Razorpay: 200 OK (Acknowledged)
```

---

## 3. Comprehensive Edge-Case Matrix

| Failure / Edge Scenario | System Response & Resolution Strategy |
| :--- | :--- |
| **1. Payment succeeds at bank, but user closes browser tab before reaching verify API.** | **Webhook Reconciliation**: Razorpay delivers `payment.captured` webhook within 15–30 seconds. Server validates webhook signature, finds the order in `PENDING_PAYMENT`, marks it `CONFIRMED`, decrements inventory, and sends confirmation email. When the user logs back in, their order appears safely in "My Orders". |
| **2. Payment succeeds, but verify API network call times out.** | **Idempotent Webhook + Order Status Polling**: The frontend displays a brief verification spinner. If timeout occurs, the frontend queries `GET /api/v1/orders/:id/status`. By this time, either the verify request was processed or the webhook arrived. |
| **3. Customer payment is declined (insufficient bank funds / wrong OTP).** | **`PAYMENT_FAILED` State**: Order status is marked `PAYMENT_FAILED`. Reserved items remain preserved for a 30-minute grace window. The user is redirected to `/payment-failure` with an active "Retry Payment" button. |
| **4. Customer clicks "Retry Payment".** | **Existing Order Reuse**: Rather than making the user re-navigate the store, `POST /api/v1/payments/retry` generates a fresh `razorpay_order_id` attached to the *existing* order, seamlessly relaunching the modal. |
| **5. Razorpay webhook is delivered twice.** | **Idempotency Guard**: Every webhook checks `payment.status`. If the payment record is already marked `SUCCESS`, the handler logs an idempotency hit and returns HTTP `200 OK` immediately without repeating stock decrements or wallet actions. |
| **6. User attempts payment signature forgery.** | **Constant-Time Verification**: Server uses `crypto.timingSafeEqual` to verify the generated HMAC against the client signature, preventing timing attacks and rejecting tampered requests. |

---

## 4. Razorpay Signature Verification Code Contract
```javascript
const crypto = require("crypto");

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(generatedSignature, "utf-8"),
    Buffer.from(signature, "utf-8")
  );
}
```
