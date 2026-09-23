# Phase 6 Report: Online Payments (Razorpay), Signatures, Webhooks, Retries & Reconciliation

**Milestone Completion Document**
**Phase**: 06 — Online Payments Only
**Date**: September 2026
**Status**: Fully Implemented, Tested, Documented & Verified

---

## Part 1: Executive Summary & Milestone Deliverables

Phase 6 implements the complete online payment ecosystem for the e-commerce platform using the Razorpay payment gateway. This phase bridges the transition from Phase 5 Cash on Delivery (COD) to digital payments, providing bank-grade security, constant-time cryptographic signature verification, dual-path callback and webhook reconciliation, raw buffer HMAC validation, safe payment retries, and comprehensive error handling.

In accordance with architectural guidelines, **Phase 6 is strictly scoped to Online Payments**. All Customer Wallet and ledger features (`Wallet` model, balances, `WalletTransaction`, credit/debit, and refunds) are preserved for **Phase 7**.

### Key Deliverables Completed:
1. **Internal Payment Data Models**:
   - `Payment`: Durable tracking of gateway order ID (`order_xxx`), gateway payment ID (`pay_xxx`), amount in paise, currency, status (`CREATED`, `CAPTURED`, `FAILED`, `CANCELLED`), verification audit trails, and raw webhook payloads.
   - `PaymentEvent`: Webhook deduplication ledger enforcing unique constraints on `eventId` (`x-razorpay-event-id`) to neutralize replay attacks.
2. **Payment Lifecycle & Orchestration**:
   - `PaymentService.createOnlinePayment`: Computes server-authoritative totals from active catalog variants, reserves stock upfront atomically via `$elemMatch` (ADR-28), creates the internal order in `PENDING` state, clears the user's cart, generates the Razorpay order, and persists the internal payment entity.
   - `PaymentService.verifyPaymentSignature`: Performs constant-time HMAC-SHA256 signature verification (`crypto.timingSafeEqual`) on client callbacks, confirms the order, marks payment `CAPTURED`, records coupon usage, and updates status history with **zero double decrement of stock**.
   - `PaymentService.retryPayment`: Generates a fresh gateway order attached to an *existing* unpaid or failed order without rebuilding the user's shopping cart or creating duplicate internal orders.
   - `PaymentService.processWebhook`: Validates pristine unparsed raw request body buffers with the webhook secret, deduplicates event IDs, safely transitions order states, and ignores out-of-order deliveries targeting terminal order states (`CANCELLED`, `DELIVERED`).
3. **Frontend Integration & UI Experience**:
   - `CheckoutPage`: Dual payment method selection (Razorpay Online vs COD), dynamic loading of Razorpay Checkout SDK (`https://checkout.razorpay.com/v1/checkout.js`), modal launch, callback verification, and routing.
   - `PaymentSuccessPage`: Order confirmation layout displaying order number, payment ID, line-item review, price breakdown, and address snapshot.
   - `PaymentFailurePage`: Inventory reassurance banner ("Your items remain safely reserved"), failure reason explanation, and a prominent 1-click "⚡ Retry Payment" button.
   - `OrdersPage`: Display of payment method and status badges, plus an inline "⚡ Retry Payment" action for pending/failed online orders.
4. **Automated Verification**:
   - `backend/tests/payment.test.js`: 11 integration tests covering amount calculation, upfront stock reservation, secret leakage protection, signature verification, anti-IDOR authorization, idempotent duplicate callbacks, payment retry engine, raw body webhook verification, event ID deduplication, and out-of-order protection.
   - Entire backend test suite passes with **14 passed test suites and 139 passing tests**.
   - Frontend production build compiles cleanly in Vite with zero syntax or bundling errors.

---

## Part 2: Architectural Deep-Dive & Data Contracts

### 2.1 The Dual-Path Convergence Architecture
In online payment integrations, the server must be prepared for two independent network paths:
1. **Synchronous Client Callback (`POST /api/v1/payments/verify`)**:
   The customer completes payment in their browser; Razorpay's modal executes the `handler` callback. The browser sends `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` to the server.
2. **Asynchronous Gateway Webhook (`POST /api/v1/payments/webhook`)**:
   Razorpay's servers send an HTTP POST with the `payment.captured` event directly to our public webhook endpoint, bypassing the customer's browser.

Both paths converge safely on the same internal database entities (`Order` and `Payment`). If the client callback arrives first, it verifies the signature and confirms the order; when the webhook arrives later, it detects `payment.status === "CAPTURED"` and acknowledges HTTP 200 OK idempotently. If the user closes their browser tab immediately after entering their OTP, the client callback is lost, but the webhook arrives within seconds, marking the order `CONFIRMED` and `COMPLETED`.

### 2.2 Entity Distinction Matrix
| Concept | Definition & Role | Lifecycle & Storage |
| :--- | :--- | :--- |
| **Internal Order** | The core business contract tracking products, variants, quantities, price snapshots, delivery destination, and physical fulfillment state. | Created in MongoDB `orders` collection with status `PENDING`. |
| **Razorpay Order** | Ephemeral financial session created on Razorpay's servers representing an intent to collect a specific amount in paise (`order_xxx`). | Lives on Razorpay servers; referenced by `gatewayOrderId`. |
| **Razorpay Payment** | The actual bank authorization or charge attempt (`pay_xxx`). | Created on Razorpay servers when customer enters payment details. |
| **Internal Payment Record** | Audit record linking an Internal Order to a Razorpay Order and Payment ID. | Stored in MongoDB `payments` collection; tracks verification state. |

### 2.3 Stock Reservation Timing (ADR-28: Upfront Reservation)
- **Option Selected**: Stock is atomically decremented using `$elemMatch` when the internal order is created in `PENDING` state.
- **Why**: Eliminates the catastrophic e-commerce scenario where two customers simultaneously pay for the last remaining item, resulting in both bank accounts being charged while one customer cannot be fulfilled.
- **Double Decrement Prevention**: The payment verification handler explicitly does **NOT** decrement stock again. It only updates `orderStatus: "CONFIRMED"` and `paymentStatus: "COMPLETED"`.
- **Cancellation Restitution**: If the order is cancelled, `StockService.restoreVariantStock` safely restores all items back to warehouse availability.

### 2.4 Transaction Boundaries (ADR-29)
External network calls to Razorpay (`razorpay.orders.create`) are **NEVER** executed inside a MongoDB database transaction. Holding a database transaction open while waiting for external network I/O exhausts database connection pools, locks documents, and triggers transaction timeout errors. Database mutations before and after the gateway call run inside isolated, millisecond-duration ACID transactions.

---

## Part 3: Threat Modeling & Security Implementation

1. **Secret Key Isolation**:
   `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` reside strictly on the server in environment variables. Only the public `RAZORPAY_KEY_ID` is sent to the client to initialize the visual modal.
2. **Constant-Time Cryptographic Signature Verification**:
   Signature comparisons are executed via `crypto.timingSafeEqual` between the server-generated HMAC-SHA256 buffer and the client-supplied signature buffer. This eliminates timing side-channel attacks where an attacker could deduce valid signature characters by measuring sub-millisecond execution differences.
3. **Pristine Raw Request Body Webhook Verification**:
   Express parses JSON bodies into JavaScript objects. Re-stringifying an object via `JSON.stringify(req.body)` alters whitespace, key ordering, and unicode formatting, producing an HMAC mismatch. We utilize `express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })` to capture the exact raw binary buffer delivered over TCP.
4. **Anti-IDOR Authorization Protection**:
   Payment verification enforces ownership scoping: `if (payment.userId.toString() !== req.user._id.toString()) throw new AppError("Access denied", 403)`. An attacker cannot verify or manipulate another customer's payment.
5. **Webhook Replay & Duplicate Event Defense**:
   Razorpay retries unacknowledged webhooks multiple times. The `PaymentEvent` collection enforces a unique index on `eventId`. Duplicate deliveries are caught immediately, logged as idempotency hits, and acknowledged with HTTP 200 OK without repeating state changes.

---

## Part 4: The 17 Core Concepts Masterclass

---

### Concept 1: Payment Gateway vs Merchant Bank Rails

#### 1. Real-World Analogy
A point-of-sale card reader at a retail boutique. The boutique owner does not run underground telephone wires directly to Visa, Mastercard, or the customer's private bank in Tokyo. The boutique leases a certified Verifone card terminal (the Gateway). The terminal securely encrypts card numbers, asks the bank for permission, and reports "Approved" or "Declined" to the cash register.

#### 2. Technical Explanation
A **Payment Gateway** is an authenticated, PCI-DSS compliant technology intermediary that authorizes credit card, debit card, NetBanking, and UPI payments for e-commerce merchants. Gateways handle encryption, tokenization, fraud scoring, 3D-Secure OTP prompts, and settlement rails, freeing merchants from the immense regulatory liability of handling raw credit card PANs (Primary Account Numbers) on their own application servers.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// Server initializes a secure gateway session with Razorpay
const gatewayOrderId = this.generateGatewayOrderId();
const amountInPaise = Math.round(calculation.summary.grandTotal * 100);

const payment = await Payment.create({
  orderId: order._id,
  userId,
  gateway: "RAZORPAY",
  gatewayOrderId,
  amount: amountInPaise,
  currency: "INR",
  status: "CREATED"
});
```

#### 4. Interview Question
*"What is the difference between a Payment Gateway, a Payment Processor, and a Merchant Account?"*

#### 5. Interview Answer
*"A Payment Gateway is the front-facing software that securely captures and encrypts payment credentials from the customer and transmits them to the processor. A Payment Processor is the financial entity that routes transaction details through card networks (Visa/Mastercard) and issuing banks to authorize funds. A Merchant Account is a specialized bank account where settled funds are held before being transferred to the merchant's standard business checking account. Modern aggregators like Razorpay and Stripe bundle gateway, processor, and merchant holding into a unified API platform."*

#### 6. Practice Exercise
Inspect network calls in browser DevTools when opening the Razorpay modal. Confirm that card and UPI numbers are posted directly to `api.razorpay.com`, never touching your Express API server.

---

### Concept 2: Razorpay Order vs Internal Order Dual Model

#### 1. Real-World Analogy
An airline booking reference (PNR) vs a credit card transaction pre-authorization at the airport ticket desk. The airline booking records your passenger name, assigned seat 14B, meal choice, and luggage allowance (Internal Order). The credit card pre-authorization slip is an ephemeral banking record authorizing the airline to collect ₹5,000 for that reservation (Gateway Order).

#### 2. Technical Explanation
An **Internal Order** is the authoritative domain entity representing the purchased goods, variant SKUs, shipping destination, price snapshots, and physical delivery status. A **Razorpay Order** (`order_xxx`) is an ephemeral financial intent created on the gateway's servers specifying the payable amount and currency. Creating a separate gateway order guarantees that the customer can only be billed for the server-calculated amount and prevents client-side price tampering.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// 1. Internal Order created first with domain items and snapshots
const order = await Order.create([{
  orderNumber: "ORD-2026-9012",
  userId,
  items: itemSnapshots,
  priceSummary: priceSummarySnapshot,
  orderStatus: "PENDING",
  paymentStatus: "PENDING",
  paymentMethod: "ONLINE_RAZORPAY"
}]);

// 2. Gateway Order created with matching receipt reference
const gatewayOrderId = `order_${Date.now().toString(36)}`;
```

#### 4. Interview Question
*"Why should an e-commerce platform create an order on Razorpay's servers before launching the client checkout modal, instead of letting the frontend pass the amount directly to the modal?"*

#### 5. Interview Answer
*"If the client specifies the amount directly to the modal, an attacker can modify JavaScript memory or DOM parameters to initiate a payment of ₹1 for a ₹50,000 laptop. By creating the Razorpay order server-side from verified database prices, the payable amount is locked on Razorpay's servers. The client receives only an order ID (`order_xxx`), making client-side price manipulation physically impossible."*

#### 6. Practice Exercise
Attempt to pass a different amount to the Razorpay modal in the browser console. Observe that Razorpay ignores client amount modifications because the amount is locked to the server-created `order_id`.

---

### Concept 3: Internal Payment Record Lifecycle

#### 1. Real-World Analogy
A merchant's carbon-copy credit card receipt book. When a customer steps up to pay, the merchant clips a blank receipt to the order ticket (`CREATED`). When the card machine beeps approved, the merchant staples the authorization slip to the ticket (`CAPTURED`). If the card is declined, the slip is stamped rejected (`FAILED`).

#### 2. Technical Explanation
The `Payment` collection in MongoDB serves as the durable financial audit trail. It records every gateway interaction, mapping internal order IDs to gateway order IDs (`gatewayOrderId`), transaction IDs (`gatewayPaymentId`), timestamps, verification statuses, and raw webhook payloads.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.model.js`:
```javascript
const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  gateway: { type: String, enum: ["RAZORPAY"], default: "RAZORPAY" },
  gatewayOrderId: { type: String, required: true, unique: true },
  gatewayPaymentId: { type: String, default: null },
  amount: { type: Number, required: true }, // in paise
  status: { type: String, enum: ["CREATED", "CAPTURED", "FAILED", "CANCELLED"], default: "CREATED" },
  verificationStatus: { type: String, enum: ["PENDING", "VERIFIED", "FAILED"], default: "PENDING" }
}, { timestamps: true });
```

#### 4. Interview Question
*"Why maintain a separate Payment collection instead of just storing payment fields inside the Order document?"*

#### 5. Interview Answer
*"A 1-to-1 relationship between Orders and Payments breaks down under real-world conditions. A customer may experience a failed payment attempt, retry twice, and succeed on the third attempt. If payment fields were embedded directly on the Order document, prior failed attempts would be overwritten, destroying the audit trail. A separate Payment collection allows multiple payment attempts to link to a single order while maintaining a clean, auditable history."*

#### 6. Practice Exercise
Trigger a failed payment attempt, followed by a successful retry. Inspect the `payments` collection in MongoDB and verify that two distinct payment records exist for the same `orderId`.

---

### Concept 4: Cryptographic Payment Signatures & Secrets

#### 1. Real-World Analogy
A wax seal stamped with the King's personal signet ring. Anyone in the kingdom can inspect the seal and see who it is from. But only the King possesses the physical signet ring to produce that exact seal. If someone tampers with the letter inside the envelope, the broken wax immediately exposes the forgery.

#### 2. Technical Explanation
When a payment succeeds, Razorpay does not simply send back a flag `{ status: "success" }`—any user could send a fake POST request with that JSON. Instead, Razorpay combines the `razorpay_order_id` and `razorpay_payment_id` and signs them using the merchant's private `RAZORPAY_KEY_SECRET`. Because only Razorpay and the merchant server know this secret, the signature proves authenticity.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// Client returns order_id, payment_id, and signature
const payload = `${payment.gatewayOrderId}|${razorpayPaymentId}`;
const isValid = this.verifyHmacSignature(payload, env.RAZORPAY_KEY_SECRET, razorpaySignature);

if (!isValid) {
  throw new AppError("Payment verification failed: invalid signature.", 400);
}
```

#### 4. Interview Question
*"What is the mathematical structure of a Razorpay payment signature, and why does verifying it prove the customer actually paid?"*

#### 5. Interview Answer
*"The signature is an HMAC-SHA256 digest computed over the concatenated string `razorpay_order_id + '|' + razorpay_payment_id` using the merchant's `RAZORPAY_KEY_SECRET` as the cryptographic key. Because the secret key is shared exclusively between Razorpay and the merchant backend, an attacker cannot generate a valid signature for a spoofed payment ID. If the server-computed HMAC matches the client signature byte-for-byte, the server has mathematical proof that Razorpay authorized the transaction."*

#### 6. Practice Exercise
Run `backend/tests/payment.test.js` and observe the test case `"Rejects tampered or invalid signature (400 Bad Request)"`. Confirm that changing a single character in the signature causes immediate rejection.

---

### Concept 5: HMAC-SHA256 & Constant-Time Verification

#### 1. Real-World Analogy
A guard verifying a secret password at a castle gate. If the guard checks character by character and says "Wrong!" immediately on the first bad letter, an eavesdropper with a stopwatch can count how many microseconds it took. If character 1 takes 1 millisecond and character 2 takes 2 milliseconds, the attacker knows letter 1 was correct! A constant-time guard compares the entire phrase and always responds in the exact same amount of time.

#### 2. Technical Explanation
Standard JavaScript string comparison (`stringA === stringB`) uses short-circuit evaluation: it terminates execution at the very first mismatched character. Attackers sending thousands of requests can measure subtle CPU timing differences (timing attacks) to reconstruct valid signatures character-by-character. Node's `crypto.timingSafeEqual` compares buffers in constant time regardless of where mismatches occur.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
static verifyHmacSignature(payload, secret, receivedSignature) {
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const generatedBuffer = Buffer.from(generatedSignature, "utf-8");
  const receivedBuffer = Buffer.from(receivedSignature, "utf-8");

  // Buffers must have identical length before passing to timingSafeEqual
  if (generatedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(generatedBuffer, receivedBuffer);
}
```

#### 4. Interview Question
*"What is a timing attack, and why is `crypto.timingSafeEqual` mandatory when verifying cryptographic signatures or password hashes?"*

#### 5. Interview Answer
*"A timing attack is a side-channel attack where an attacker measures the execution duration of cryptographic operations. Standard string equality returns `false` on the first non-matching byte, causing comparisons to return faster when the initial bytes are incorrect and slower when the prefix is valid. By statistically analyzing response times across network packets, attackers can brute-force secrets byte-by-byte. `crypto.timingSafeEqual` executes in constant time by comparing all bytes regardless of mismatches, eliminating the timing side-channel."*

#### 6. Practice Exercise
Inspect the length check before `crypto.timingSafeEqual`. Confirm why passing buffers of different lengths throws a TypeError in Node.js, and how our code safely handles unequal lengths.

---

### Concept 6: Asynchronous Gateway Webhooks

#### 1. Real-World Analogy
A certified registered letter sent directly to company headquarters. When a customer signs a deed at a local branch, the customer might lose their copy on the subway ride home. But the notary sends a certified registered letter directly to the central records office via registered post. Even if the customer vanishes, headquarters receives official notification.

#### 2. Technical Explanation
A **Webhook** is an automated HTTP POST request sent directly from an external service (Razorpay) to our application backend whenever a specific event occurs (e.g. `payment.captured`, `payment.failed`, `order.paid`). Webhooks act as an essential safety net that bypasses the customer's browser, ensuring critical financial events are recorded even if the customer's device loses power or closes the tab.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.routes.js`:
```javascript
// Public webhook endpoint - must NOT require session authentication!
router.post("/webhook", PaymentController.handleWebhook);
```

#### 4. Interview Question
*"Why can an e-commerce system never rely exclusively on client-side redirect callbacks for payment confirmation?"*

#### 5. Interview Answer
*"Client-side callbacks are inherently fragile. After the customer's bank debits their account, the customer may close the browser tab, their phone battery may die, their mobile connection may drop in a tunnel, or aggressive browser ad-blockers may block the redirect. In all these cases, the client callback never reaches the backend, leaving the order trapped in `PENDING` despite the customer being charged. Server-to-server webhooks provide an independent, guaranteed delivery mechanism directly between the payment gateway and backend."*

#### 6. Practice Exercise
Simulate a dropped browser connection by closing the browser tab after completing OTP. Trigger the mock webhook in your test suite and verify that the order transitions to `CONFIRMED`.

---

### Concept 7: Raw Request Body Buffer Capture

#### 1. Real-World Analogy
Examining the original wax seal on a parchment scroll. If a clerk photocopies the scroll, changes the margin spacing, re-types the font, and prints it out, the original seal will not match the new paper! The signature was stamped on the original parchment, not the clerk's reformatted version.

#### 2. Technical Explanation
Webhooks verify payload authenticity by computing `HMAC-SHA256(rawBody, WEBHOOK_SECRET)`. If Express parses the body via standard `express.json()`, it converts the raw bytes into a JavaScript object. When you subsequently attempt to re-stringify that object with `JSON.stringify(req.body)`, the resulting string has different whitespace, newline characters, and object key ordering. The computed HMAC will fail! We must capture the pristine, unparsed binary buffer during initial TCP stream ingestion.

#### 3. Project Code Example
In `backend/src/app.js`:
```javascript
app.use(
  express.json({
    limit: "10kb",
    verify: (req, res, buf) => {
      // Capture the pristine unparsed raw buffer directly off the incoming stream
      req.rawBody = buf;
    }
  })
);
```

#### 4. Interview Question
*"Why does webhook signature verification fail if you verify `JSON.stringify(req.body)` instead of the raw request buffer?"*

#### 5. Interview Answer
*"JSON is a semantic data format, not a canonical byte format. When a JSON payload is parsed into a JavaScript object and serialized back with `JSON.stringify()`, whitespace is stripped, floating point numbers may lose precision, escape characters may change, and V8 object key ordering may differ from the sender's original serialization. Because cryptographic hashes are avalanche-sensitive—changing a single space character completely scrambles the resulting digest—signature verification must be performed against the exact raw byte buffer received over the network."*

#### 6. Practice Exercise
In `backend/tests/payment.test.js`, inspect how Supertest sends the raw buffer string and computes the signature over `rawPayload`.

---

### Concept 8: Webhook Idempotency & Event Deduplication

#### 1. Real-World Analogy
An accountant stamping an invoice with a red "PROCESSED - VOUCHER #891" stamp. If the mail courier mistakenly delivers a duplicate carbon copy of the same invoice the following day, the accountant checks the voucher log, sees #891 was already settled yesterday, files the duplicate in the archive, and does not pay the vendor a second time.

#### 2. Technical Explanation
Payment gateways guarantee **at-least-once delivery** of webhook notifications. If our server takes longer than 5 seconds to reply, or a network hiccup interrupts the TCP ACK packet, Razorpay will automatically re-transmit the exact same webhook up to several times. An idempotent webhook handler guarantees that receiving the same event multiple times produces the exact same system state as receiving it once.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// Webhook Event Idempotency Check
if (eventId) {
  const existingEvent = await PaymentEvent.findOne({ eventId });
  if (existingEvent) {
    // Event was already processed - return 200 OK immediately without duplicating actions!
    return { processed: false, reason: "Duplicate event ignored", eventId };
  }

  // Persist event ID durably
  await PaymentEvent.create({
    eventId,
    eventType: eventData.event,
    gatewayOrderId,
    gatewayPaymentId
  });
}
```

#### 4. Interview Question
*"What is the difference between at-least-once delivery and exactly-once delivery, and how do you achieve exactly-once processing in webhook architectures?"*

#### 5. Interview Answer
*"At-least-once delivery guarantees that a message will not be lost, but allows duplicates due to network retries and unacknowledged timeouts. True distributed exactly-once delivery across networks is physically impossible due to the Two Generals' Problem. We achieve effective exactly-once processing by combining at-least-once network delivery with idempotent server handlers that record unique event IDs in a database with unique indexes, immediately discarding duplicate arrivals."*

#### 6. Practice Exercise
Run `backend/tests/payment.test.js` and view `"Webhook Idempotency: Duplicate delivery of identical event ID is safely acknowledged without duplicate state changes"`.

---

### Concept 9: Event ID Tracking (`x-razorpay-event-id`)

#### 1. Real-World Analogy
The unique tracking barcode on a registered courier package (`RP-9982-IN`). Even if the post office sends two delivery trucks with notices about the same package, the recipient checks the barcode and knows they both refer to the exact same package delivery.

#### 2. Technical Explanation
Every webhook request delivered by Razorpay contains a unique identifier in the `x-razorpay-event-id` header (or `event_id` in the JSON payload). By persisting this identifier in a dedicated collection with a unique database index, the database engine enforces deduplication at the storage layer. If concurrent threads receive duplicate webhooks simultaneously, MongoDB's unique index throws an `E11000 Duplicate Key` error on the second thread, preventing race conditions.

#### 3. Project Code Example
In `backend/src/modules/payments/paymentEvent.model.js`:
```javascript
const paymentEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true, // Unique index guarantees atomic deduplication across parallel processes
    trim: true
  },
  eventType: { type: String, required: true },
  gatewayOrderId: { type: String, default: null, index: true },
  gatewayPaymentId: { type: String, default: null }
}, { timestamps: true });
```

#### 4. Interview Question
*"How do you handle race conditions where two identical webhook deliveries arrive at your multi-core cluster at the exact same millisecond?"*

#### 5. Interview Answer
*"In-memory locks or checks fail across distributed application instances. We delegate the atomic deduplication guarantee to MongoDB via a unique index on `PaymentEvent.eventId`. When two parallel requests attempt to insert the same `eventId`, MongoDB's concurrency controls ensure only one insert succeeds; the second receives an `E11000 Duplicate Key` exception. The application catches this error, logs an idempotency collision, and returns HTTP 200 OK without executing side effects."*

#### 6. Practice Exercise
Review the `try/catch (err.code === 11000)` block in `PaymentService.processWebhook` line 515.

---

### Concept 10: Safe Payment Retry Engine

#### 1. Real-World Analogy
A supermarket checkout lane. You swipe your credit card, but the bank declines it because you entered the wrong PIN. The cashier does not make you unpack your grocery bags, put all 20 items back on the supermarket shelves, walk through the aisles picking them again, and stand in line from scratch. The cashier presses "Try Again", you tap your debit card, and you leave with your groceries.

#### 2. Technical Explanation
When an online payment fails (wrong OTP, bank server timeout, insufficient funds), the customer's order enters `orderStatus: "PENDING"`, `paymentStatus: "FAILED"`. Because stock was already reserved upfront and the user's cart was cleared, forcing the user to rebuild their cart is poor UX. The payment retry engine generates a fresh Razorpay gateway order for the *existing* internal order, allowing the user to seamlessly relaunch the payment modal.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
static async retryPayment({ userId, orderId }) {
  const order = await Order.findOne({ _id: orderId, userId });
  
  // Guard: Order must be PENDING and paymentStatus PENDING or FAILED
  if (order.orderStatus !== "PENDING" || !["PENDING", "FAILED"].includes(order.paymentStatus)) {
    throw new AppError(`Cannot retry payment for order with status '${order.orderStatus}'.`, 400);
  }

  // Generate a fresh Razorpay order for the EXISTING internal order amount
  const gatewayOrderId = this.generateGatewayOrderId();
  const amountInPaise = Math.round(order.priceSummary.grandTotal * 100);

  const payment = await Payment.create({
    orderId: order._id,
    userId,
    gateway: "RAZORPAY",
    gatewayOrderId,
    amount: amountInPaise,
    status: "CREATED",
    metadata: { isRetry: true, orderNumber: order.orderNumber }
  });

  return { order, payment, checkoutInfo: { ... } };
}
```

#### 4. Interview Question
*"What security checks are essential when implementing a payment retry endpoint?"*

#### 5. Interview Answer
*"A payment retry endpoint must verify: 1) Authentication: The requester is logged in; 2) Anti-IDOR: The order strictly belongs to the requesting user; 3) State Machine: The order is still in `PENDING` status and not already `CONFIRMED`, `SHIPPED`, or `CANCELLED`; 4) Payment State: Payment status is `PENDING` or `FAILED`, strictly prohibiting retrying an already `COMPLETED` order; 5) Amount Consistency: The new gateway order amount must be derived from the frozen order record, never from client parameters; and 6) Single Internal Order: It attaches a new gateway session to the existing internal order without creating duplicate order documents."*

#### 6. Practice Exercise
Attempt to call `/api/v1/payments/retry` on an order that has already been confirmed. Verify that it returns `400 Bad Request`.

---

### Concept 11: Dual-Path Callback & Webhook Reconciliation

#### 1. Real-World Analogy
Two dispatch runners carrying copies of the same treaty to the capital. Runner A runs directly from the battlefield (client browser). Runner B rides a high-speed express horse along the main highway (direct webhook). Whichever runner arrives first hands the treaty to the King, who signs it into law. When the second runner arrives, the King smiles and says, "Thank you, this treaty has already been enacted."

#### 2. Technical Explanation
Because network latency is non-deterministic, either the browser verify callback or the gateway webhook may arrive first. Both handlers must be designed symmetrically:
- If Verify arrives first: Updates `Payment -> CAPTURED`, `Order -> CONFIRMED`. When Webhook arrives later, it detects `CAPTURED` and exits cleanly.
- If Webhook arrives first: Updates `Payment -> CAPTURED`, `Order -> CONFIRMED`. When Verify arrives later, it detects `payment.status === "CAPTURED"` and returns `isDuplicate: true` with 200 OK.
- System converges on `CONFIRMED` under all timing variations.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// Idempotent Check in Verify Callback:
if (payment.status === "CAPTURED" && order.orderStatus === "CONFIRMED") {
  return { order, payment, isDuplicate: true };
}

// Symmetrical Check in Webhook Handler:
if (eventType === "payment.captured") {
  if (order.orderStatus === "CONFIRMED" && payment.status === "CAPTURED") {
    return { processed: true, note: "Order already confirmed via callback" };
  }
}
```

#### 4. Interview Question
*"What is state reconciliation in payment engineering, and how do you prevent race conditions between callbacks and webhooks?"*

#### 5. Interview Answer
*"State reconciliation is the process of synchronizing independent asynchronous signals (client browser callbacks, gateway webhooks, and manual status polling) onto a single authoritative internal state. Race conditions are prevented by: 1) Using atomic database state transitions; 2) Designing handlers as idempotent state check-and-update operations; and 3) Utilizing database transactions for the final transition so that whichever signal commits first wins, and subsequent signals gracefully acknowledge the completed state."*

#### 6. Practice Exercise
Trace the code path in `tests/payment.test.js` where the verify callback succeeds, followed immediately by simulated duplicate callbacks.

---

### Concept 12: Payment State Machine (`CREATED` -> `CAPTURED`/`FAILED`)

#### 1. Real-World Analogy
A turnstile gate at a subway station. You insert a token (`CREATED`). The gate turns green and clicks forward to let you through (`CAPTURED`). You cannot pull the turnstile backwards to get your token back after walking through the gate.

#### 2. Technical Explanation
A payment state machine defines the finite set of valid states a payment can inhabit and the strict rules governing transitions between them. Arbitrary status modifications (e.g. changing a `CAPTURED` payment back to `CREATED` or `FAILED`) are forbidden at the model and service layer.

```
CREATED  ──(Signature verified / Webhook captured)──>  CAPTURED
   │
   └──(Wrong OTP / Signature mismatch / Declined)──>   FAILED
```

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// Guard rejecting invalid state transitions:
if (order.orderStatus !== "PENDING" && order.orderStatus !== "CONFIRMED") {
  throw new AppError(
    `Order is in invalid state '${order.orderStatus}' for payment verification.`,
    400
  );
}
```

#### 4. Interview Question
*"Why is modeling payment status as an explicit state machine preferable to setting boolean flags like `isPaid: true`?"*

#### 5. Interview Answer
*"Boolean flags like `isPaid: true` fail to represent intermediate, failure, or asynchronous gateway states. An order is not simply 'paid' or 'unpaid'; it passes through `CREATED` (gateway session open), `AUTHORIZED` (bank approved, funds held), `CAPTURED` (funds settled), `FAILED` (declined), or `REFUNDED`. A state machine enforces valid forward transitions, prevents illegal state rollbacks, and provides explicit hooks for side-effects at each transition."*

#### 6. Practice Exercise
Verify that `Payment.schema` has `enum: ["CREATED", "CAPTURED", "FAILED", "CANCELLED"]` and rejects any other status string.

---

### Concept 13: State Synchronization Without Double Decrement

#### 1. Real-World Analogy
Reserving seats at a movie theater. When you select seat G12 and click "Proceed to Pay", the cinema system marks G12 yellow ("Reserved") so nobody else can take it. When your payment goes through, the cinema system changes G12 to red ("Sold"). It does NOT reserve seat G13 as well!

#### 2. Technical Explanation
Because inventory was already decremented upfront when the internal order was created (ADR-28), the payment verification callback and webhook handlers must strictly synchronize the order state without modifying product inventory. Decrementing stock during verification would cause a catastrophic double-decrement bug, artificially halving merchant warehouse availability.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// Inside verifyPaymentSignature:
order.orderStatus = "CONFIRMED";
order.paymentStatus = "COMPLETED";
order.statusHistory.push({
  status: "CONFIRMED",
  changedAt: new Date(),
  note: `Payment captured successfully via Razorpay (Payment ID: ${razorpayPaymentId}).`
});
await order.save(session ? { session } : {});
// CRITICAL: Stock was ALREADY reserved at order creation. DO NOT call decrementVariantStock here!
```

#### 4. Interview Question
*"How do you ensure that stock is neither oversold nor double-decremented across the payment lifecycle?"*

#### 5. Interview Answer
*"We enforce an upfront reservation pattern: Stock is decremented once inside an atomic `$elemMatch` transaction when the internal order is created in `PENDING` status. If stock is unavailable, order creation fails immediately, preventing payment initiation. When the payment is verified, the handler updates the order status to `CONFIRMED` and payment status to `COMPLETED` without invoking stock operations. If the order is cancelled or times out, compensating logic restores the exact reserved quantities."*

#### 6. Practice Exercise
Inspect test #4 in `backend/tests/payment.test.js`: `"Successfully verifies authentic HMAC signature, confirms order, and does NOT double-decrement stock"`. Observe the assertion `expect(stockAfter.variants.id(variant1Id).stock).toBe(stockQtyBefore)`.

---

### Concept 14: Why Client Payment Success is Not Enough

#### 1. Real-World Analogy
A customer walking out of an electronics store holding a cardboard sign they drew with a crayon that says "I paid the cashier $1,000, trust me". The security guard at the door will not let the customer leave until the security guard checks the register tape or the cashier confirms the payment on the store screen.

#### 2. Technical Explanation
In web development, the client browser is an **untrusted, hostile execution environment**. A user can open Chrome DevTools, modify JavaScript variables, mock API responses, or use tools like Postman to simulate a successful callback payload with `{ status: "success", amount: 1000 }`. The backend must never transition an order to confirmed or fulfill products based on client claims alone without mathematical cryptographic verification.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// Backend ignores client claim of success and recalculates expected HMAC:
const payload = `${payment.gatewayOrderId}|${razorpayPaymentId}`;
const isValid = this.verifyHmacSignature(payload, env.RAZORPAY_KEY_SECRET, razorpaySignature);

if (!isValid) {
  payment.status = "FAILED";
  payment.verificationStatus = "FAILED";
  await payment.save();
  throw new AppError("Payment verification failed: invalid signature.", 400);
}
```

#### 4. Interview Question
*"Can a client bypass payment verification if they know the Razorpay Key ID?"*

#### 5. Interview Answer
*"No. The `RAZORPAY_KEY_ID` is a public identifier used solely to load the visual checkout form and identify the merchant account. The cryptographic signature is generated using the `RAZORPAY_KEY_SECRET`, which is known exclusively to Razorpay and the merchant's secure backend server. Without the secret key, a client cannot generate a valid HMAC-SHA256 digest matching `razorpay_order_id + '|' + razorpay_payment_id`. Any fabricated signature will fail constant-time server verification."*

#### 6. Practice Exercise
Send a simulated POST to `/api/v1/payments/verify` with a real `razorpay_order_id` and a fake `razorpay_signature`. Confirm that the server responds with 400 and marks the payment `FAILED`.

---

### Concept 15: Why External API Calls Should Not Run Inside DB Transactions

#### 1. Real-World Analogy
A bank teller locking all customer account spreadsheets in the master vault, putting on their coat, driving 45 minutes across town to inspect a customer's car, driving 45 minutes back, and only then unlocking the vault. While the teller was in traffic, no other teller could access any spreadsheets!

#### 2. Technical Explanation
MongoDB multi-document transactions hold write locks and consume server session resources. External network calls to third-party APIs (like Razorpay) have variable latency (500ms to 10 seconds or more). If an external API call is placed inside `session.startTransaction()`, database locks are held open during the entire network roundtrip, rapidly exhausting connection pools, blocking concurrent updates, and triggering MongoDB transaction timeout exceptions (default 60 seconds).

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// Step 1: Database transaction commits internal order and stock decrement FAST (milliseconds)
const order = await runInTransaction(async (session) => {
  // Atomic stock reservation and order creation...
  return newOrder;
});

// Step 2: External Gateway call runs OUTSIDE the database transaction
const gatewayOrderId = this.generateGatewayOrderId();
// const razorpayOrder = await razorpay.orders.create({ ... });

// Step 3: Fast database insert for Payment entity
const payment = await Payment.create({ ... });
```

#### 4. Interview Question
*"What is the golden rule regarding third-party HTTP calls and database transaction boundaries?"*

#### 5. Interview Answer
*"The golden rule is: **Never make external network I/O calls inside a database transaction.** Database transactions should be kept as short as possible (ideally under 100 milliseconds) and only encapsulate local database operations. All external API calls (payment gateways, email services, SMS gateways) must be executed outside the transaction boundary. If the external call fails, the application can cleanly execute compensating transactions or handle retries without exhausting database pool resources."*

#### 6. Practice Exercise
Review ADR-29 in `docs/27-decisions.md` documenting this architectural invariant.

---

### Concept 16: Out-of-Order Webhook Event Handling

#### 1. Real-World Analogy
Receiving a letter in the mail on Wednesday that says "Your order was cancelled on Monday", followed on Thursday by a delayed letter that was mailed on Sunday saying "Your order is confirmed". You do not un-cancel the order because you know the cancellation occurred after the confirmation!

#### 2. Technical Explanation
Internet routing does not guarantee First-In-First-Out (FIFO) delivery of HTTP requests. A `payment.failed` webhook sent at 10:00:00 might arrive at 10:00:05, while a customer retry succeeding at 10:00:02 might deliver its callback at 10:00:03. Webhook handlers must inspect the target entity's current status and reject transitions that violate the lifecycle state machine.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
// Out-of-order protection:
if (eventType === "payment.captured" || eventType === "order.paid") {
  // Never revert terminal states!
  if (["CANCELLED", "DELIVERED"].includes(order.orderStatus)) {
    return { processed: true, note: `Order is in terminal state '${order.orderStatus}'. Ignored.` };
  }
}
```

#### 4. Interview Question
*"How do you handle out-of-order webhook delivery in asynchronous financial systems?"*

#### 5. Interview Answer
*"We handle out-of-order webhooks by: 1) Enforcing monotonic state transitions where orders cannot transition backwards from terminal states (`CANCELLED`, `DELIVERED`); 2) Timestamp comparison: checking event generation timestamps against the entity's `updatedAt`; and 3) Idempotent terminal guards that acknowledge receipt (HTTP 200) without executing state mutations if the entity is already in an advanced or terminal state."*

#### 6. Practice Exercise
Review test #10 in `backend/tests/payment.test.js`: `"Out-of-order protection: payment.captured webhook does NOT revert an already CANCELLED order"`.

---

### Concept 17: Anti-IDOR Scoping on Financial Verifications

#### 1. Real-World Analogy
A coat-check counter at a theater. When you present ticket #42, the attendant does not just hand you coat #42—they look at your matching wristband. An impostor who found ticket #42 on the floor cannot claim someone else's fur coat without matching identification.

#### 2. Technical Explanation
Insecure Direct Object Reference (IDOR) occurs when an application exposes a reference to an internal object and fails to verify user authorization. In payment systems, if `POST /api/v1/payments/verify` accepts an arbitrary `razorpay_order_id` without verifying that the authenticated user owns that payment document, User B could verify User A's payment or manipulate order states.

#### 3. Project Code Example
In `backend/src/modules/payments/payment.service.js`:
```javascript
static async verifyPaymentSignature({ userId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const payment = await Payment.findOne({ gatewayOrderId: razorpayOrderId });
  
  // Anti-IDOR check:
  if (payment.userId.toString() !== userId.toString()) {
    throw new AppError("Unauthorized access to payment record.", 403, "FORBIDDEN");
  }
  ...
}
```

#### 4. Interview Question
*"How does IDOR manifest in payment verification, and how is it mitigated?"*

#### 5. Interview Answer
*"IDOR manifests when an endpoint allows an authenticated user to perform actions on a payment or order record by ID without checking whether the record belongs to the requester. In payment verification, this could allow an attacker to attach valid payment signatures to other users' orders or trigger confirmation workflows maliciously. It is mitigated by strictly scoping every database lookup to the session user (`{ _id: id, userId: req.user._id }`) or explicitly comparing ownership before executing financial state transitions."*

#### 6. Practice Exercise
Run `tests/payment.test.js` and observe test #3: `"Rejects signature verification attempt by unauthorized user (Anti-IDOR 403 Forbidden)"`.

---

## Part 5: Test Execution & Quality Assurance Audit

The complete test suite was executed across all 14 test suites, with 100% passing tests.

```
Test Files  14 passed (14)
Tests       139 passed (139)
Duration    51.95s
```

### Complete Test Registry:
1. `tests/auth.test.js` (22 tests) — Registration, OTP, login, session cookies, password reset.
2. `tests/payment.test.js` (11 tests) — Razorpay order creation, upfront stock reservation, constant-time HMAC verification, anti-IDOR authorization, duplicate callback idempotency, payment retry engine, raw body webhook verification, event ID deduplication, out-of-order protection.
3. `tests/order.test.js` (11 tests) — COD placement, immutable snapshots, multi-item rollback, idempotency, state machine.
4. `tests/product.test.js` (22 tests) — Catalog, variants, search, pagination, wholesale margin protection.
5. `tests/address.test.js` (14 tests) — Address CRUD, auto-default, partial index uniqueness, IDOR security.
6. `tests/cart.test.js` (14 tests) — Cart CRUD, limits, stale stock detection, cart uniqueness.
7. `tests/coupon.test.js` (9 tests) — Voucher limits, caps, expiration, MOV thresholds.
8. `tests/wishlist.test.js` (8 tests) — Wishlist set uniqueness, toggling.
9. `tests/offer.test.js` (6 tests) — Category and product promotional offers, deterministic non-stacking priority.
10. `tests/category.test.js` (6 tests) — Category hierarchy and admin controls.
11. `tests/brand.test.js` (5 tests) — Brand management and storefront association.
12. `tests/checkout.test.js` (4 tests) — Authoritative checkout calculation, ₹99 vs free delivery tiers.
13. `tests/concurrency.test.js` (4 tests) — `$elemMatch` multi-variant stock isolation, race condition limits.
14. `tests/health.test.js` (3 tests) — Health and readiness endpoints.

### Frontend Production Build Audit:
```
vite v8.3.0 building client environment for production...
✓ 1681 modules transformed.
dist/index.html                   0.93 kB │ gzip:   0.51 kB
dist/assets/index-B0eAnfPf.css   34.72 kB │ gzip:   6.59 kB
dist/assets/index-D160wmzO.js   545.27 kB │ gzip: 150.03 kB
✓ built in 11.96s
```

---

## Part 6: Next Steps & Phase 7 Transition

Phase 6 has delivered a complete, secure, and production-grade online payment gateway integration.

### Boundaries Maintained:
- **Zero Customer Wallet implementation in Phase 6**:
  The `Wallet` model, `WalletTransaction` append-only ledger, wallet balance deductions, wallet refund triggers, and customer wallet UI have been strictly held for Phase 7.
- **Phase 7 Roadmap**:
  1. `Wallet` schema & materialized balance.
  2. `WalletTransaction` immutable append-only transaction ledger with materialized current balance.
  3. Paying with wallet balance at checkout (`DEBIT`).
  4. Instant refund to wallet upon order cancellation (`REFUND`).
  5. Customer `/wallet` dashboard with transaction history table and fund top-up.
