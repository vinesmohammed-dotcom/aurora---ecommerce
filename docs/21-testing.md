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
| **`checkout.test.js`** | 1. Tests multi-step checkout calculation.<br/>2. **Concurrency Test**: Runs 5 simultaneous checkout requests on an item with `stock: 2`. Verifies exactly 2 succeed and 3 fail with `OUT_OF_STOCK`.<br/>3. Verifies wallet balance deduction and final payable calculation. |
| **`payment.test.js`** | 1. Tests signature verification endpoint with valid HMAC.<br/>2. Tests rejection of tampered signature.<br/>3. Tests webhook idempotency: delivering the same `payment.captured` event twice results in a single confirmation. |

---

## 3. Frontend Testing Specifications (Vitest + React Testing Library)

| Component / Feature | Test Scenarios |
| :--- | :--- |
| **`Button.jsx`** | Renders loading spinner when `isLoading={true}` and disables user click events. |
| **`Input.jsx`** | Displays inline error message when invalid prop is passed. |
| **`ProductCard.jsx`**| Displays discounted price badge when active offer exists; disables button if `stock === 0`. |
| **`authSlice.test.js`**| Redux slice: Tests `loginSuccess`, `logout`, and state hydration from session check. |
| **`CartDrawer.jsx`** | Renders item rows, calculates visual subtotal, triggers quantity update actions. |

---

## 4. Execution Commands & Automation

```bash
# Run all backend unit & integration tests
npm test

# Run tests in watch mode during development
npx vitest

# Generate code coverage report
npm run test:coverage
```

### Phase 1 Verification Results (Recorded Live)
- **Test File**: `backend/tests/health.test.js`
- **Runner**: Vitest v3.2.7 with Supertest v7.0.0
- **Output**:
  ```
  ✓ tests/health.test.js (2 tests) 64ms
  Test Files  1 passed (1)
       Tests  2 passed (2)
  ```
- **Assertions Verified**:
  - `GET /api/v1/health` returns HTTP 200, `{ success: true, message: "API is healthy", data: { status: "ok", ... } }`.
  - Non-existent endpoints return HTTP 404 with standard operational error envelope `{ success: false, code: "NOT_FOUND" }`.
  - Confirmed `app.js` runs in memory without requiring a live MongoDB instance or TCP port listener during test runs.
