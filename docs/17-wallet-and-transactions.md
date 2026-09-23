# 17 — Customer Wallet & Append-Only Transaction Ledger

## 1. The Immutable Ledger Principle
A catastrophic anti-pattern in amateur financial systems is simply updating a user's balance column (`user.walletBalance += 500`) without an immutable log. If the customer claims funds vanished, or a bug double-credits an account, there is zero audit trail to reconstruct financial history.

### The Append-Only Ledger Architecture
Wallet uses an immutable append-only transaction ledger with a materialized current balance. The balance consistency invariant is verified as total credits minus total debits:
1. **`Wallet`** holds the current materialized balance (`balance: Number`, `currency: "INR"`). Exactly one wallet per user (`userId` unique).
2. **`WalletTransaction`** is an **append-only, immutable journal**. Records are never updated or deleted (`updatedAt: false`).
3. The `Wallet.balance` must always equal the mathematical sum of all historical transactions:
   $$\text{balance} = \sum \text{CREDIT} - \sum \text{DEBIT}$$

---

## 2. Policy Separation: Razorpay Gateway Refund vs. Customer Wallet

> [!IMPORTANT]
> **Architectural Separation Principle (ADR-30)**
> - **Gateway Refunds (Razorpay)**: Online payments paid via Razorpay (UPI, Debit/Credit Card, Netbanking) are refunded **directly back to the original funding source** via the Razorpay Gateway Refund API.
> - **Customer Wallet**: Represents internal stored value. Used exclusively for promotional rewards, goodwill gestures, customer compensation, and manual administrative adjustments.
> - A Razorpay refund **never** creates a Wallet transaction.
> - A Wallet transaction **never** creates a Razorpay gateway refund.

---

## 3. Transaction Types & Schema Definitions

### Wallet Schema (Minor Units: Paise)
```javascript
{
  userId: { type: ObjectId, ref: "User", required: true, unique: true },
  balance: {
    type: Number,
    default: 0,
    min: [0, "Balance cannot be negative"],
    validate: {
      validator: Number.isInteger,
      message: "Wallet balance must be an integer (paise)"
    }
  },
  currency: { type: String, default: "INR", uppercase: true }
}
```

### WalletTransaction Schema (Minor Units: Paise)
```javascript
{
  walletId: { type: ObjectId, ref: "Wallet", required: true, index: true },
  userId: { type: ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
  amount: {
    type: Number,
    required: true,
    min: [1, "Amount must be at least 1 paisa"],
    validate: {
      validator: Number.isInteger,
      message: "Transaction amount must be an integer (paise)"
    }
  },
  balanceBefore: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: "balanceBefore must be an integer (paise)"
    }
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: "balanceAfter must be an integer (paise)"
    }
  },
  referenceType: {
    type: String,
    enum: [
      "ADMIN_CREDIT",
      "ADMIN_DEBIT",
      "PROMOTIONAL_CREDIT",
      "ORDER_CANCELLATION_CREDIT",
      "RETURN_CREDIT",
      "WALLET_PAYMENT"
    ],
    required: true
  },
  referenceId: { type: String, default: null, trim: true },
  description: { type: String, default: "", trim: true },
  metadata: { type: Mixed, default: {} }
}
```

### Compound Idempotency Index
```javascript
walletTransactionSchema.index(
  { referenceType: 1, referenceId: 1 },
  { unique: true, partialFilterExpression: { referenceId: { $type: "string" } } }
);
```
This compound partial index prevents duplicate credit or debit operations for the same business event (e.g. `PROMOTIONAL_CREDIT` + `PROMO_WELCOME_500`).

---

## 4. Pure Integer Arithmetic Pipeline in Multi-Document Transactions

Every balance modification runs inside a MongoDB ACID transaction (`runInTransaction`) using pure integer arithmetic (zero floating-point operations):
1. Locate or create wallet record for `userId`.
2. For debit operations: assert `wallet.balance >= amountPaise`.
3. Compute `balanceBefore = wallet.balance`.
4. Compute `balanceAfter = balanceBefore + amountPaise` (for credit) or `balanceBefore - amountPaise` (for debit).
5. Update `wallet.balance = balanceAfter`.
6. Append immutable `WalletTransaction` document.
7. Emit structured financial audit log (`ADMIN_WALLET_CREDIT` or `ADMIN_WALLET_DEBIT`).
8. Commit transaction or roll back completely on any failure.

```javascript
static async creditWallet({ userId, amount, referenceType, referenceId, description, metadata }) {
  const amountPaise = Math.round(Number(amount));
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new AppError("Credit amount must be a positive integer in paise", 400);
  }

  return await runInTransaction(async (session) => {
    const wallet = await this.getOrCreateWallet(userId, session);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amountPaise;

    wallet.balance = balanceAfter;
    await wallet.save({ session });

    const [transaction] = await WalletTransaction.create(
      [{
        walletId: wallet._id,
        userId,
        type: "CREDIT",
        amount: amountPaise,
        balanceBefore,
        balanceAfter,
        referenceType,
        referenceId,
        description,
        metadata
      }],
      { session }
    );

    return { wallet, transaction };
  });
}
```

### Mathematical Reconciliation Equation
Wallet uses an immutable append-only transaction ledger with a materialized current balance. The balance consistency invariant is verified as total credits minus total debits:
$$\text{Wallet.balance} = \sum \text{CREDIT transactions} - \sum \text{DEBIT transactions}$$
Any discrepancy between materialized balance and ledger transactions indicates an integrity violation.

---

## 5. UI Presentation Boundary Conversion
All internal services, database collections, and API contracts communicate exclusively in integer minor units (paise: ₹1 = 100 paise; ₹1000 = 100000 paise).
Conversion to major currency units (rupees) occurs **strictly at presentation boundaries**:
- In the React frontend (`WalletPage.jsx`):
  ```javascript
  const formattedBalance = `₹${(wallet.balance / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const formattedTxAmount = `${tx.type === "CREDIT" ? "+" : "-"}₹${(tx.amount / 100).toFixed(2)}`;
  ```
- Business logic, validation schemas, and database fields never perform floating-point operations.

---

## 6. Security, Anti-IDOR & Financial Audit Logging
1. **User Scoping**: Customer endpoints (`/api/v1/wallet`, `/api/v1/wallet/transactions`) strictly extract `req.user._id` from the secure session. Customers cannot inspect or query another user's wallet.
2. **Admin Role Isolation**: Administrative endpoints (`/api/v1/admin/wallets/:userId/credit`, `/api/v1/admin/wallets/:userId/debit`) require both `requireAuth` and `requireRole("ADMIN")`. Every admin mutation logs `metadata.adjustedByAdminId` and an administrative reason for auditability.
3. **Non-Negative Invariant**: Both the application service checks (`balance < amountPaise`) and Mongoose schema validation (`min: 0`, `validate: Number.isInteger`) guarantee that wallet balances can never drop below zero or store fractional paise.
4. **Structured Financial Audit Logging**: All admin wallet balance modifications emit structured audit logs via `auditLogger.js` (`ADMIN_WALLET_CREDIT`, `ADMIN_WALLET_DEBIT`), recording `adminId`, `userId`, `amountPaise`, `balanceBefore`, `balanceAfter`, and `reason`, while automatically redacting any credentials or sensitive tokens.

