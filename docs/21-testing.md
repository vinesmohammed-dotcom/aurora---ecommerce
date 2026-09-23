# 21 — Comprehensive Testing Strategy & Quality Assurance Plan

## 1. The Testing Pyramid Strategy
For a professional portfolio project, testing is not an afterthought—it provides proof to interviewers that the system is robust, regression-free, and handles high-risk financial edge cases gracefully.

```
       / \
      /   \      E2E / Smoke Tests (Critical Checkout & Login Flows)
     /     \
    /-------\
   /         \   Integration Tests (Supertest API endpoints + MongoDB memory server)
  /           \
 /-------------\
/               \ Unit Tests (Vitest: Discount math, order state transitions, auth helpers)
-----------------
```

---

## 2. Backend Test Specifications (Vitest + Supertest)

### 2.1 Unit Tests (`backend/tests/unit/`)
- **`couponMath.test.js`**:
  - Validates percentage discount calculations and cap limits.
  - Asserts that coupon discounts can **never** result in negative order totals.
  - Verifies flat discount deductions.
- **`orderStateMachine.test.js`**:
  - Tests allowed transitions (`CONFIRMED` → `PROCESSING` → `SHIPPED`).
  - Asserts that forbidden transitions (`SHIPPED` → `CANCELLED`) throw standard domain exceptions.
- **`razorpaySignature.test.js`**:
  - Tests HMAC-SHA256 signature generator with valid key/secret pairs.
  - Asserts that modified payment IDs or tampered signatures return `false`.

### 2.2 API Integration Tests (`backend/tests/integration/`)
Using `supertest` with an in-memory or dedicated MongoDB test database:

| Test Suite | Test Case Scenarios Covered |
| :--- | :--- |
| **`auth.test.js`** | 1. Registers new user & generates OTP.<br/>2. Verifies correct OTP establishes session cookie (`connect.sid`).<br/>3. Rejects invalid OTP with 400.<br/>4. Verifies blocked user is rejected at login with 403. |
| **`catalog.test.js`** | 1. Tests product listing pagination (`page=1&limit=10`).<br/>2. Tests category filter and price sorting.<br/>3. Tests text search query matching. |
| **`cart.test.js`** | 1. Adds variant to user cart.<br/>2. Increments quantity; rejects quantity > stock with 409.<br/>3. Verifies cart item price is dynamically calculated from DB. |
| **`checkout.test.js`** | 1. Tests multi-step checkout calculation.<br/>2. **Concurrency Test**: Runs simultaneous checkout requests.<br/>3. Verifies tiered shipping fee (₹99 vs free delivery above ₹1,000). |
| **`payment.test.js`** | 1. Calculates server-authoritative amount in paise and reserves stock upfront.<br/>2. Rejects secret key leakage in response payload.<br/>3. Rejects tampered HMAC signature (400 Bad Request).<br/>4. Anti-IDOR: Rejects signature verification attempt by unauthorized user (403 Forbidden).<br/>5. Verifies authentic HMAC signature, confirms order, and asserts **zero double decrement of stock**.<br/>6. Idempotency: Duplicate payment verification returns existing state without side effects.<br/>7. Payment Retry: Allows retrying payment on unpaid/failed order without rebuilding cart; rejects retry for already confirmed order.<br/>8. Webhook Signature: Verifies raw request body HMAC against webhook secret.<br/>9. Webhook Idempotency: Duplicate delivery of identical `x-razorpay-event-id` is safely acknowledged without duplicate state changes.<br/>10. Out-of-order protection: `payment.captured` webhook does NOT revert an already `CANCELLED` order. |
| **`wallet.test.js`** | 1. Auto-creates zero-balance wallet for user on initial query.<br/>2. Enforces unique constraint (1 wallet per user).<br/>3. Atomic credit in integer paise with append-only ledger record.<br/>4. Atomic debit in integer paise with balance decrement and ledger entry.<br/>5. Rejects debit when balance is insufficient (never negative).<br/>6. Mongoose schema constraint enforces `balance >= 0` and `validate: Number.isInteger`.<br/>7. Compound idempotency constraint on `{ referenceType, referenceId }` prevents duplicate credits.<br/>8. Paginated transaction history query.<br/>9. Anti-IDOR: User cannot access another user's wallet.<br/>10. Admin credit with audit tracking and reason.<br/>11. Admin debit with audit tracking.<br/>12. Security: Non-admin rejected with 403.<br/>13. Pure integer paise arithmetic (no floats).<br/>14. **Balance Consistency Equation**: Verifies $\text{Wallet.balance} = \sum \text{credits} - \sum \text{debits}$. |
| **`adminReports.test.js`** | 1. Aggregates gross sales, net sales, discounts, and refunds across date ranges in integer paise.<br/>2. Streams styled executive A4 PDF reports via pure-JS `pdfkit`.<br/>3. Generates RFC 4180 CSV export files.<br/>4. Variant-level inventory matrix with low-stock warnings.<br/>5. Customer account governance and self-suspension prevention. |
| **`e2e.test.js` (API-Level E2E)** | 17-scenario end-to-end lifecycle verification:<br/>- Customer signup, OTP verification, session generation.<br/>- Catalog browsing, cart management, checkout price derivation.<br/>- COD order placement, atomic stock decrements, wallet verification.<br/>- Admin dashboard, inventory matrix, user governance, CSV & PDF report exports.<br/>- Full return lifecycle (Request -> Review -> Receive -> Inspect -> Restock).<br/>- Security invariants: Role isolation (403), auth protection (401), session fixation defense, and session invalidation on password change. |

> [!NOTE]
> **E2E Test Classification**:
> - `backend/tests/e2e.test.js` is an **API-Level End-to-End Integration Test Suite**. It drives real Express endpoints via Supertest against a live database with stateful cookies, asserting the full multi-step business lifecycle without browser rendering overhead.
> - Browser-level UI rendering and client navigation are covered by **Playwright Browser Smoke Tests** (`frontend/tests/e2e/smoke.spec.js`).

---

## 3. Frontend Testing Specifications (Vitest + Playwright)

### 3.1 Component & Redux Slice Tests
| Component / Feature | Test Scenarios |
| :--- | :--- |
| **`Button.jsx`** | Renders loading spinner when `isLoading={true}` and disables user click events. |
| **`Input.jsx`** | Displays inline error message when invalid prop is passed. |
| **`ProductCard.jsx`**| Displays discounted price badge when active offer exists; disables button if `stock === 0`. |
| **`authSlice.test.js`**| Redux slice: Tests `loginSuccess`, `logout`, and state hydration from session check. |
| **`CartDrawer.jsx`** | Renders item rows, calculates visual subtotal, triggers quantity update actions. |

### 3.2 Browser E2E Smoke Tests (`frontend/tests/e2e/smoke.spec.js`)
| Test | Scenario |
| :--- | :--- |
| **Homepage Render** | Renders brand identity, responsive navbar, and cart drawer button. |
| **Catalog Route** | Navigates to `/products`, verifies URL routing and search/filter inputs. |
| **Auth Route** | Navigates to `/login`, verifies email, password fields and submission button. |

---

## 4. Execution Commands & Automation

```bash
# Run all backend unit, integration, and API-level E2E tests
npm test

# Run API E2E test suite specifically
npx vitest run tests/e2e.test.js

# Run Playwright browser smoke tests (frontend/)
npx playwright test
```

### Complete Verification Results (Phase 9 Final Hardening)
- **Runner**: Vitest v3.2.7 with Supertest v7.0.0
- **Summary**:
  ```
  Test Files  18 passed (18)
       Tests  204 passed (204)
    Duration  73.69s
  ```
- **Key Suites Verified**:
  - `tests/e2e.test.js`: 17 tests passed (100% full lifecycle, RMA, and security verification).
  - `tests/adminReports.test.js`: 17 tests passed (minor-unit aggregations, PDFKit streaming, CSV exports).
  - `tests/refund.test.js`: 11 tests passed (paise standardization, money unit test, concurrency protection, failure retry, return inspection gate).
  - `tests/wallet.test.js`: 14 tests passed (pure integer paise, balance consistency equation, idempotency, admin guards).
  - `tests/payment.test.js`: 17 tests passed (upfront reservation, HMAC verification, retry, webhooks).
  - `tests/order.test.js`: 11 tests passed (frozen snapshots, state transitions, stock restoration).
  - `tests/concurrency.test.js`: 4 tests passed (variant stock atomic decrements).
  - Frontend Build: `vite build` completed in 2.54s with zero warnings (client bundle reduced to 490.63 kB).


