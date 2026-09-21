# 17 — Customer Wallet & Immutable Transaction Ledger

## 1. The Immutable Ledger Principle
A catastrophic anti-pattern in amateur financial systems is simply updating a user's balance column (`user.walletBalance += 500`) without an immutable log. If the customer claims funds vanished, or a bug double-credits an account, there is zero audit trail to reconstruct financial history.

### The Double-Entry Architecture
In this system:
1. **`Wallet`** holds the current materialized balance (`balance: Number`).
2. **`WalletTransaction`** is an **append-only, immutable journal**. Records are never updated or deleted.
3. The `Wallet.balance` must always equal the mathematical sum of all historical transactions:
   $$\text{balance} = \sum \text{CREDIT} + \sum \text{REFUND} + \sum \text{PROMO} - \sum \text{DEBIT}$$

---

## 2. Transaction Types & State Transitions

| Transaction Type | Mathematical Sign | Trigger Scenario | Order Linked? |
| :--- | :--- | :--- | :--- |
| **`CREDIT`** | $+ \text{Amount}$ | Customer loads money into wallet or receives referral bonus. | Optional |
| **`DEBIT`** | $- \text{Amount}$ | Customer uses wallet funds to pay for an order at checkout. | **Required** |
| **`REFUND`** | $+ \text{Amount}$ | Instant refund credited back to wallet upon order cancellation or approved return. | **Required** |
| **`PROMOTIONAL_CREDIT`** | $+ \text{Amount}$ | Admin grants promotional credits for marketing campaigns. | Optional |

---

## 3. ACID Database Transactions in Wallet Operations

Every wallet mutation **must execute inside a MongoDB Multi-Document ACID Transaction** (`session = await mongoose.startSession(); session.startTransaction()`).

### 3.1 Example 1: Paying with Wallet at Checkout (`DEBIT`)
```javascript
async function payWithWallet(userId, orderId, debitAmount, session) {
  // 1. Fetch wallet with lock
  const wallet = await Wallet.findOne({ user: userId }).session(session);
  if (!wallet || wallet.balance < debitAmount) {
    throw new AppError("Insufficient wallet balance", 400);
  }

  // 2. Atomic decrement with non-negative guard
  const updatedWallet = await Wallet.findOneAndUpdate(
    { _id: wallet._id, balance: { $gte: debitAmount } },
    { $inc: { balance: -debitAmount } },
    { new: true, session }
  );

  if (!updatedWallet) {
    throw new AppError("Concurrent wallet modification detected. Please retry.", 409);
  }

  // 3. Append immutable transaction record
  await WalletTransaction.create([
    {
      wallet: wallet._id,
      amount: debitAmount,
      type: "DEBIT",
      order: orderId,
      description: `Payment for Order #${orderId}`,
      balanceAfter: updatedWallet.balance
    }
  ], { session });

  return updatedWallet.balance;
}
```

### 3.2 Example 2: Instant Refund on Order Cancellation (`REFUND`)
When an order in `CONFIRMED` state is cancelled, refunding to the original credit card takes 5–7 business days via banking rails. Refunding directly to the customer's wallet provides **instant gratification**:
```javascript
async function refundToWallet(userId, orderId, refundAmount, session) {
  // 1. Increment wallet balance atomically
  const updatedWallet = await Wallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: refundAmount } },
    { new: true, upsert: true, session }
  );

  // 2. Append immutable ledger transaction
  await WalletTransaction.create([
    {
      wallet: updatedWallet._id,
      amount: refundAmount,
      type: "REFUND",
      order: orderId,
      description: `Refund for cancelled Order #${orderId}`,
      balanceAfter: updatedWallet.balance
    }
  ], { session });

  return updatedWallet.balance;
}
```

---

## 4. Concurrency & Integrity Invariants
- **In-Memory Concurrency Protection**: The `{ balance: { $gte: debitAmount } }` precondition guarantees that even if a user fires two parallel checkout requests simultaneously, only one will succeed; the second will throw an insufficient balance exception.
- **Balance Invariant**: A Mongoose schema validation rule enforces `min: 0` on `wallet.balance`, making negative wallet balances physically impossible at the database level.
