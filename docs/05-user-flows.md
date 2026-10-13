# 05 — End-to-End Customer User Flows

## 1. Overview
This document maps every primary customer journey across the platform from initial onboarding to checkout, payment retry, order tracking, returns, and invoice retrieval.

---

## 2. Onboarding & Account Management Flows

### 2.1 Registration & Verification Journey
```mermaid
flowchart TD
    VisitSignup([Customer visits /register]) --> FillForm[Enters Name, Email, Password, Phone]
    FillForm --> ClientVal{Zod Validation Pass?}
    ClientVal -- No --> ShowFormErr[Show inline field errors]
    ClientVal -- Yes --> SubmitReg[POST /api/v1/auth/register]
    SubmitReg --> ServerCheck{Email Unique?}
    ServerCheck -- No --> ShowExistErr[Display 'Email already registered']
    ServerCheck -- Yes --> SavePendingUser[User saved: isVerified=false]
    SavePendingUser --> SendOTP[Generate 6-digit OTP & Send via SES]
    SendOTP --> ShowOTPModal[Render OTP Verification Modal with 60s timer]
    ShowOTPModal --> EnterOTP[Customer enters OTP]
    EnterOTP --> VerifyAPI[POST /api/v1/auth/verify-otp]
    VerifyAPI --> CheckOTP{Valid & Unexpired?}
    CheckOTP -- No --> ShowOTPErr[Invalid/Expired OTP message]
    CheckOTP -- Yes --> SetSession[Session Cookie Established & isVerified=true]
    SetSession --> Storefront([Redirect to Storefront /shop])
```

### 2.2 Password Recovery & Email Update
- **Forgot Password**: Enters email → Receives 6-digit reset code → Enters OTP + new password → Old sessions invalidated → Prompted to log in.
- **Change Email**: Enters new email → Verification OTP dispatched to *new* email address → Submitting OTP updates email in database.
- **Address Management**: Profile page provides a clean address book. Customers can add multiple addresses (Home, Office) and set a default shipping destination.

---

## 3. Shopping, Discovery & Cart Flows

### 3.1 Catalog Search & Faceted Filtering
```mermaid
flowchart LR
    SearchInput[Keyword Search] --> Debounce[Debounce 300ms]
    Debounce --> APIQuery[GET /api/v1/products]
    CategorySelect[Category Filter] --> APIQuery
    PriceRange[Price Slider] --> APIQuery
    SortOption[Sort: Price / Newest] --> APIQuery
    APIQuery --> RenderGrid[Render Product Cards with Skeleton Loaders]
```

### 3.2 Variant Selection & Add-to-Cart
1. Customer clicks product card → Navigates to `/product/:slug`.
2. Selects Variant Attributes (e.g. Size: "9", Color: "Black").
3. Live component updates price tag and stock status ("In Stock" vs "Only 2 Left" vs "Out of Stock").
4. Clicks "Add to Cart":
   - Optimistic UI opens the Cart Drawer immediately.
   - Dispatches `POST /api/v1/cart/items`.
   - Redux `cartSlice` updates badge count in Navbar.

---

## 4. Checkout, Payment & Retry Engine

### 4.1 Multi-Step Checkout Flow
```mermaid
flowchart TD
    Cart([Customer in Cart]) --> ClickCheckout[Click 'Proceed to Checkout']
    ClickCheckout --> Step1[Step 1: Select or Add Shipping Address]
    Step1 --> Step2[Step 2: Order Review & Apply Coupon Code]
    Step2 --> ApplyCoupon{Apply Coupon?}
    ApplyCoupon -- Yes --> ValCoupon[POST /api/v1/checkout/apply-coupon]
    ValCoupon --> UpdateBill[Discount deducted & total refreshed]
    ApplyCoupon -- No --> Step3
    UpdateBill --> Step3[Step 3: Payment Method Selection]
    Step3 --> Choice{Method?}
    Choice -- Wallet --> CheckBal{Wallet covers 100%?}
    CheckBal -- Yes --> DirectConfirm[Order CONFIRMED instantly]
    CheckBal -- No --> SplitPay[Wallet balance applied + Remaining to Razorpay]
    Choice -- COD --> CODConfirm[Order CONFIRMED directly]
    Choice -- Razorpay --> LaunchRzp[Launch Razorpay Modal]
    LaunchRzp --> PayResult{Payment Result?}
    PayResult -- Success --> VerifySignature[POST /api/v1/payments/verify-signature]
    VerifySignature --> SuccessPage([Redirect to /order-success])
    PayResult -- Dismissed / Failed --> FailPage([Redirect to /payment-failure])
    FailPage --> RetryBtn[Customer clicks 'Retry Payment']
    RetryBtn --> LaunchRzp
```

---

## 5. Post-Purchase Fulfillment & Returns

### 5.1 Order Tracking & Cancellation
- Customer navigates to `/my-orders`.
- Orders show live visual progress bar: `CONFIRMED` → `PROCESSING` → `SHIPPED` → `DELIVERED`.
- If order is `CONFIRMED` or `PROCESSING`, an active **"Cancel Order"** button is available.
- Cancellation prompts for reason → Restocks inventory atomically → Issues instant 100% refund into customer's Wallet.

### 5.2 Return Request Flow (Within 7 Days)
1. Order enters `DELIVERED` state.
2. System activates "Request Return" button for exactly 7 days from `deliveredAt`.
3. Customer submits return request with reason (e.g., "Size too small", "Defective item").
4. Order status transitions to `RETURN_REQUESTED`.
5. Admin reviews request in dashboard:
   - If Approved: Order transitions to `RETURNED` → Item collected → Quality check passes → Refund credited to customer wallet.
   - If Rejected: Order reverts to `DELIVERED` with explanation note.

### 5.3 PDF Invoice Download
- Customer clicks "Download Tax Invoice" on order detail view.
- Client triggers `GET /api/v1/orders/:id/invoice`.
- Server streams pre-generated PDF from AWS S3 or generates on-the-fly with complete tax breakdown.

### 5.4 Customer Product Ratings & Verified Reviews Flow

```mermaid
flowchart TD
    Buy[Customer purchases product] --> Deliver[Order delivered: status DELIVERED]
    Deliver --> ViewProduct[Customer opens product page /products/:slug]
    ViewProduct --> VerifyBackend{Backend verifies purchase?}
    VerifyBackend -- No Delivered Order / Already Reviewed --> ReadOnly[Read existing reviews & aggregate rating]
    VerifyBackend -- Eligible Delivered Order Found --> ShowWriteBtn[Display 'Write a Review' action]
    ShowWriteBtn --> OpenModal[Open review dialog: 1-5 stars, headline, comment]
    OpenModal --> SubmitReview[POST /api/v1/products/:id/reviews]
    SubmitReview --> ServerValidation[Server validates rating, text, and re-verifies ownership]
    ServerValidation --> StoreReview[Review stored with isVerifiedPurchase=true & status=PUBLISHED]
    StoreReview --> UpdateAgg[MongoDB $facet aggregation updates average & distribution]
    UpdateAgg --> Display[Verified Review displayed on product page with badge]
```

#### Core Distinction:
- **Authentication**: Who the customer is (valid identity session).
- **Authorization**: What the customer is allowed to do (RBAC roles, resource ownership).
- **Verified Purchase**: Backend confirms the customer actually bought and received the product (`DELIVERED` state).

For full architectural details, see [29-ratings-and-reviews.md](./29-ratings-and-reviews.md).

