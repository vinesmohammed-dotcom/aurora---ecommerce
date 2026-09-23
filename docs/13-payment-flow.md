# 13 — Razorpay Payment Architecture & Webhook Synchronization

## 1. High-Level Gateway Architecture
Payment integration is the most high-risk component of any commercial platform. A single security flaw can result in inventory theft or financial fraud.

### The Golden Rule of Payment Security
> **The frontend client must NEVER know the payment secret, and must NEVER specify the payment amount to Razorpay.**
> - The backend calculates the exact authoritative amount from verified database catalog prices.
> - Stock is reserved upfront during internal order creation (ADR-28) to prevent overselling.
> - The backend issues an authenticated `orders.create` API call directly to Razorpay.
> - Razorpay returns a `razorpay_order_id`, which the frontend uses solely to open the visual checkout modal.
> - A payment is **NEVER** marked successful based on client callback claims alone. The backend must mathematically verify the HMAC SHA-256 signature using constant-time comparison or receive a verified webhook event before fulfilling the order.

---

## 2. Dual-Path Synchronization Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Browser)
    participant React as React Frontend
    participant Server as Express Server (/api/v1/payments)
    participant Razorpay as Razorpay Gateway Server
    participant DB as MongoDB Database

    Customer->>React: Click "Proceed to Online Payment"
    React->>Server: POST /api/v1/payments/create { addressId, couponCode, idempotencyKey }
    Note over Server: 1. Calculate price from DB catalog<br/>2. Atomically reserve variant stock (ADR-28)<br/>3. Create Internal Order (PENDING)<br/>4. Clear user cart
    Server->>Razorpay: razorpay.orders.create({ amount: amountInPaise, currency: "INR", receipt: orderId })
    Razorpay-->>Server: Return { id: "order_K7x9Z..." }
    Server->>DB: Save Payment doc { gatewayOrderId: "order_K7x9Z...", status: "CREATED" }
    Server-->>React: Return { orderId, paymentId, razorpayOrderId, amount, keyId, prefill }

    React->>Customer: Launch Razorpay Modal (Checkout.js)
    Customer->>Razorpay: Enters UPI / Card details and completes 3D-Secure OTP
    
    alt Synchronous Success (Normal Path)
        Razorpay-->>React: Return { razorpay_order_id, razorpay_payment_id, razorpay_signature }
        React->>Server: POST /api/v1/payments/verify { ...payload }
        Note over Server: Compute HMAC SHA-256:<br/>crypto.createHmac('sha256', KEY_SECRET)<br/>.update(order_id + "|" + payment_id)<br/>.digest('hex') === signature
        alt Signature Matches
            Server->>DB: DB Transaction: Payment (CAPTURED) & Order (CONFIRMED & COMPLETED)
            Server-->>React: 200 OK { success: true, redirect: "/payment-success" }
            React->>Customer: Render Payment Success screen
        else Signature Mismatch
            Server-->>React: 400 Bad Request (Tampered Payment Data)
        end
    else User Closes Tab / Drops Connection
        Note over Customer,Razorpay: Customer's bank debited, but browser tab was closed before verify reached server!
    end

    Note over Razorpay,Server: Asynchronous Safety Net (Webhooks):
    Razorpay-)Server: POST /api/v1/payments/webhook [Event: payment.captured]
    Note over Server: 1. Verify X-Razorpay-Signature with WEBHOOK_SECRET using raw buffer<br/>2. Webhook Idempotency: Check x-razorpay-event-id in PaymentEvent collection<br/>3. If order is already CONFIRMED, return 200 OK immediately.<br/>4. If order is still PENDING, update Payment (CAPTURED) and Order (CONFIRMED)!
    Server--)Razorpay: 200 OK (Acknowledged)
```

---

## 3. Entity Distinction Matrix

| Concept | Definition & Authority | Storage Location |
| :--- | :--- | :--- |
| **Internal Order** | The primary business contract representing purchased line-items, prices, shipping address, and fulfillment lifecycle (`PENDING` -> `CONFIRMED` -> `DELIVERED`). | MongoDB `orders` collection |
| **Razorpay Order** | Ephemeral gateway session representing an intent to collect a specific amount in paise (`order_xxx`). Created by backend API call. | Razorpay Gateway Servers |
| **Razorpay Payment** | The banking authorization attempt generated when the customer submits their credentials (`pay_xxx`). | Razorpay Gateway Servers |
| **Internal Payment Record** | Durable record capturing the relationship between an Internal Order, the Razorpay Order, the gateway payment ID, and the cryptographic verification state. | MongoDB `payments` collection |

---

## 4. Comprehensive Edge-Case Matrix

| Failure / Edge Scenario | System Response & Resolution Strategy |
| :--- | :--- |
| **1. Payment succeeds at bank, but user closes browser tab before reaching verify API.** | **Webhook Reconciliation**: Razorpay delivers `payment.captured` webhook within 15–30 seconds. Server validates webhook signature using the raw body buffer, finds the order in `PENDING`, marks it `CONFIRMED` and `COMPLETED`. When the user logs back in, their order appears safely in "My Orders". |
| **2. Payment succeeds, but verify API network call times out.** | **Idempotent Webhook + Order Status Polling**: The frontend displays a brief verification spinner. If timeout occurs, the frontend queries `GET /api/v1/payments/order/:orderId`. By this time, either the verify request was processed or the webhook arrived. |
| **3. Customer payment is declined (insufficient bank funds / wrong OTP).** | **`FAILED` State**: Payment and Order payment status are marked `FAILED`. Reserved items remain preserved. The user is redirected to `/payment-failure` with an active "Retry Payment" button. |
| **4. Customer clicks "Retry Payment".** | **Existing Order Reuse**: Rather than making the user re-navigate the store or rebuild their cart, `POST /api/v1/payments/retry` generates a fresh `gatewayOrderId` attached to the *existing* order, seamlessly relaunching the modal. |
| **5. Razorpay webhook is delivered twice.** | **Event ID Deduplication Guard**: Every webhook checks `x-razorpay-event-id` against the `PaymentEvent` collection. If already processed, the handler logs an idempotency hit and returns HTTP `200 OK` immediately without repeating state transitions. |
| **6. User attempts payment signature forgery.** | **Constant-Time Verification**: Server uses `crypto.timingSafeEqual` to verify the generated HMAC against the client signature, preventing timing attacks and rejecting tampered requests. |
| **7. Webhook arrives out of order.** | **State Machine Transition Guard**: A late `payment.captured` webhook will NEVER revert an order that is already in a terminal state like `CANCELLED` or `DELIVERED`. |

---

## 5. Razorpay Signature Verification Code Contracts

### 5.1 Client Payment Callback Verification
```javascript
const crypto = require("crypto");

function verifyRazorpaySignature({ orderId, paymentId, signature, secret }) {
  const payload = `${orderId}|${paymentId}`;
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const generatedBuffer = Buffer.from(generatedSignature, "utf-8");
  const receivedBuffer = Buffer.from(signature, "utf-8");

  if (generatedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(generatedBuffer, receivedBuffer);
}
```

### 5.2 Webhook Raw Buffer Signature Verification
```javascript
function verifyWebhookSignature({ rawBodyBuffer, signature, webhookSecret }) {
  const generatedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBodyBuffer)
    .digest("hex");

  const generatedBuffer = Buffer.from(generatedSignature, "utf-8");
  const receivedBuffer = Buffer.from(signature, "utf-8");

  if (generatedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(generatedBuffer, receivedBuffer);
}
```

---

## 6. Comprehensive Payment & Stock Reservation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Browser)
    participant Server as Express Server
    participant DB as MongoDB
    participant Gateway as Razorpay API

    Note over Customer,Gateway: Step 1: Checkout & Upfront Stock Reservation
    Customer->>Server: POST /api/v1/payments/create { addressId, couponCode }
    Server->>DB: 1. Authoritative Checkout Calculation
    Server->>DB: 2. Atomic Stock Decrement ($elemMatch condition)
    Server->>DB: 3. Create Order (orderStatus: PENDING, paymentStatus: PENDING, paymentExpiresAt: NOW + 15m)
    Server->>DB: 4. Clear Cart
    Server->>DB: COMMIT DB Transaction

    Note over Server,Gateway: Step 2: Gateway Session (Outside DB Transaction)
    Server->>Gateway: POST /orders { amount: paise, currency: INR }
    alt Gateway Succeeds
        Gateway-->>Server: Return { id: "order_K7x..." }
        Server->>DB: Create Payment (status: CREATED, gatewayOrderId: "order_K7x...")
        Server-->>Customer: Return { checkoutInfo, razorpayOrderId, paymentExpiresAt }
    else Gateway Call Fails
        Server->>DB: Compensation Rollback: Restore Stock + Mark Order CANCELLED
        Server-->>Customer: 500 Bad Gateway Error (Zero Leaked Inventory)
    end

    Note over Customer,Server: Step 3: Payment Verification & State Convergence
    Customer->>Gateway: Submit Payment Credentials
    alt Path A: Synchronous Callback
        Gateway-->>Customer: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
        Customer->>Server: POST /api/v1/payments/verify
        Server->>Server: Constant-Time HMAC Signature Check
        Server->>DB: Update Payment -> CAPTURED, Order -> CONFIRMED & COMPLETED
        Server-->>Customer: 200 OK (Redirect to /payment-success)
    else Path B: Asynchronous Webhook
        Gateway-)Server: POST /api/v1/payments/webhook [Event: payment.captured]
        Server->>Server: Verify Raw-Buffer HMAC with Webhook Secret
        Server->>DB: Record PaymentEvent (Deduplicated)
        Server->>DB: Update Payment -> CAPTURED, Order -> CONFIRMED & COMPLETED
        Server--)Gateway: 200 OK Acknowledged
    end
```

---

## 7. Reservation Expiration Flow (Preventing Permanent Inventory Lock)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Abandoned Customer
    participant Sweeper as Cleanup Engine (OrderService)
    participant DB as MongoDB
    participant Catalog as Inventory Stock

    Note over Customer,DB: Customer initiates checkout but abandons modal without paying
    Customer->>DB: Order created in PENDING, paymentExpiresAt = T0 + 15 min
    Note over DB,Catalog: Stock is held reserved in catalog

    Note over Sweeper,DB: 15 Minutes Elapsed (T0 + 15m Passed)
    Sweeper->>DB: Query orders where orderStatus=PENDING AND paymentExpiresAt < NOW
    DB-->>Sweeper: Return [Order ORD-101]

    Note over Sweeper,Catalog: Idempotent Atomic Cancellation & Stock Restoration
    Sweeper->>DB: findOneAndUpdate({ _id: ORD-101, orderStatus: "PENDING" }, { orderStatus: "CANCELLED", paymentStatus: "EXPIRED" })
    alt Lock Acquired (First Worker)
        Sweeper->>Catalog: Restore variant stock for all line-items
        Sweeper->>DB: Update Payment records status to EXPIRED
        Note over Catalog: Reserved inventory returned safely to live catalog
    else Concurrently Processed / Already Cancelled
        Note over Sweeper: Skip restoration (Zero double-stock restore guarantee)
    end

    alt Customer Later Attempts Payment Retry with Expired Order
        Customer->>Sweeper: POST /api/v1/payments/retry { orderId: ORD-101 }
        Sweeper-->>Customer: 400 Bad Request: "Payment reservation has expired. Please create a new order."
    end
```

---

## 8. Financial Reconciliation Flow (Payment Captured After Order Cancellation)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant Server as Express Server
    participant DB as MongoDB
    participant Gateway as Razorpay Webhook

    Note over Customer,DB: Step 1: Order Cancelled (ByUser or Expiration)
    Customer->>Server: Cancel Order / Reservation Times Out
    Server->>DB: Order transitions to CANCELLED
    Server->>DB: Reserved Stock Restored to Catalog

    Note over Gateway,Server: Step 2: Late Payment Capture Arrives
    Gateway-)Server: POST /api/v1/payments/webhook [payment.captured]
    Server->>Server: Verify Webhook HMAC Signature
    Server->>DB: Deduplicate Event ID in PaymentEvent collection
    Server->>DB: Fetch Order & Payment record

    Note over Server,DB: Step 3: Preserve Financial Truth Without Corrupting Order State
    Server->>DB: Short DB Transaction:
    Note over DB: 1. Payment.status = CAPTURED<br/>2. Payment.reconciliationStatus = REFUND_REQUIRED<br/>3. Order.orderStatus REMAINS CANCELLED (Never reverted to CONFIRMED)<br/>4. Order.paymentStatus = REFUND_REQUIRED<br/>5. ZERO stock restoration or deduction!
    Server--)Gateway: 200 OK Acknowledged

    Note over Server,DB: Step 4: Phase 7 Boundary
    Note over Server,DB: Actual refund/wallet credit will be handled in Phase 7 via REFUND_REQUIRED query.
```

---

## 9. Explicit Payment State Transition Map

```
                  ┌───────────────┐
                  │    CREATED    │
                  └───────┬───────┘
          ┌───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
    │AUTHORIZED │   │  FAILED   │   │ CANCELLED │   │  EXPIRED  │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │               │
          │ (Verify/WH)   │ (Late capture)│ (Late capture)│ (Late capture)
          ▼               ▼               ▼               ▼
    ┌───────────────────────────────────────────────────────────┐
    │                         CAPTURED                          │
    │  (If Order is CANCELLED -> reconciliation: REFUND_REQUIRED)│
    └──────────────┬─────────────────────────────┬──────────────┘
                   │                             │
                   ▼ (Full Refund)               ▼ (Partial Refund)
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │         REFUNDED          │   │    PARTIALLY_REFUNDED     │
    └───────────────────────────┘   └─────────────┬─────────────┘
                                                  │ (Balance cleared)
                                                  ▼
                                    ┌───────────────────────────┐
                                    │         REFUNDED          │
                                    └───────────────────────────┘
```

---

## 10. Phase 7 Gateway Refunds & State Mapping

### 10.1 Application Payment State vs Razorpay Gateway State
Do not blindly copy vendor states into the internal model. The table below outlines the exact mapping:

| Razorpay Gateway State | Application Payment State | Semantics in System |
| :--- | :--- | :--- |
| `created` | `CREATED` | Gateway order created, client modal not yet authorized. |
| `authorized` | `CAPTURED` | In our auto-capture architecture, authorized payments are captured immediately. |
| `captured` | `CAPTURED` | Payment successfully captured and verified. Charge intake terminal. |
| `failed` | `FAILED` | Gateway transaction failed or declined by card network/bank. |
| `refunded` (full) | `REFUNDED` | Entire captured amount has been refunded back to original funding source. |
| `refunded` (partial) | `PARTIALLY_REFUNDED` | Portion of captured amount returned; additional refunds permitted up to cap. |
| *N/A (App-only)* | `EXPIRED` | 15-minute payment reservation window elapsed; inventory safely released. |
| *N/A (App-only)* | `CANCELLED` | Customer or admin cancelled order before payment completed. |

### 10.2 Domain Separation: Order vs Payment vs Wallet vs Refund
- **Order**: What the customer purchased (items, quantities, price summary, delivery address, shipping status).
- **Payment**: How the order was paid (gateway, amounts in paise, verification state, reconciliation status).
- **Refund**: Money returned against a captured online payment via Razorpay rails back to original source.
- **Wallet**: Customer's internal stored-value account (promotional rewards, goodwill compensation, admin credits).
- **WalletTransaction**: An immutable append-only ledger entry tracking internal wallet balance movements.

### 10.3 Monetary Representation in Integer Minor Units (Paise)
- All financial calculations, storage schemas, and API arguments operate in **integer minor units (paise: ₹1 = 100 paise; ₹1000 = 100000 paise)**.
- `payment.amount` is stored in integer paise.
- `payment.committedRefundPaise` tracks capacity reserved for pending/processed refunds in integer paise.
- `refund.amount` is stored in integer paise (`validate: Number.isInteger`).
- All calculations are strictly:
  $$\text{maxRefundablePaise} = \text{capturedAmountPaise} - \text{committedRefundPaise}$$
- No division or multiplication by 100 occurs inside backend services or database layers. Conversion to rupees happens strictly at user presentation boundaries.

### 10.4 ADR-32: Refund Concurrency & Pre-Gateway Capacity Reservation
To prevent concurrent refund requests from over-refunding a captured payment (e.g. two parallel ₹700 refund requests on a ₹1000 payment), the system implements an atomic conditional reservation pattern on `Payment`:
```javascript
const updatedPayment = await Payment.findOneAndUpdate(
  {
    _id: payment._id,
    $expr: {
      $lte: [
        { $add: ["$committedRefundPaise", refundAmountPaise] },
        "$amount"
      ]
    }
  },
  { $inc: { committedRefundPaise: refundAmountPaise } },
  { new: true }
);
```
- If another concurrent request reserved capacity first such that the total would exceed `payment.amount`, `updatedPayment` returns `null`, and the service immediately aborts with HTTP 400 (`Total refund amount exceeds captured payment amount`).
- This guarantees safety on both standalone MongoDB instances and replica set clusters.

### 10.5 ADR-29: Refund Execution Boundary Isolation & Failure Rollback
External Razorpay refund API calls are **strictly executed outside MongoDB database transactions**:
1. **Pre-Gateway Capacity Reservation & Record Creation**:
   - Atomically increment `Payment.committedRefundPaise` by `refundAmountPaise`.
   - Create `Refund` document in `PENDING` state with `idempotencyKey`.
2. **External Gateway Call (Outside DB Transaction)**:
   - Invoke `razorpay.payments.refund(gatewayPaymentId, { amount: refundAmountPaise })`.
3. **On Gateway Success**:
   - Update `Refund` to `PROCESSED` with `gatewayRefundId`.
   - Transition `Payment` status (`REFUNDED` if `committedRefundPaise === amount`, else `PARTIALLY_REFUNDED`).
   - Transition `Order.paymentStatus` (`REFUNDED` or `PARTIALLY_REFUNDED`).
   - If order was `RETURN_APPROVED`, transition `orderStatus` to `RETURNED`.
   - If order was `REFUND_REQUIRED`, transition `payment.reconciliationStatus = "SETTLED"`.
   - Emit `ADMIN_INITIATED_REFUND` structured financial audit log.
4. **On Gateway Failure (Network timeout, 5xx error, gateway rejection)**:
   - Atomically release reserved capacity: `Payment.findByIdAndUpdate(payment._id, { $inc: { committedRefundPaise: -refundAmountPaise } })`.
   - Mark `Refund` document `FAILED` with `failureReason`.
   - Return HTTP 500 error. The order and payment retain their valid state, and the released capacity immediately enables a successful subsequent retry.


