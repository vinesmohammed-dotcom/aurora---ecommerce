# 03 — Frontend Architecture & State Boundary Guide

## 1. Architectural Philosophy: Feature-Sliced Organization
For an e-commerce application with diverse domains (Auth, Catalog, Cart, Checkout, User Profile, Admin Dashboard), organizing code purely by technical types (`components/`, `reducers/`) causes severe file fragmentation. 

Instead, this project adopts a **Feature-Sliced Architecture**:
- Reusable, domain-agnostic UI primitives (Buttons, Modals, Inputs) live in `components/`.
- Domain-specific logic, UI, hooks, and services are grouped inside cohesive modules under `features/`.

---

## 2. Directory Structure

```
frontend/
├── src/
│   ├── app/                # App-level routing and context providers
│   │   ├── App.jsx         # Root component mounting routes and global providers
│   │   ├── routes.jsx      # React Router route configuration (Protected & Public routes)
│   │   └── main.jsx        # ReactDOM entry point
│   │
│   ├── assets/             # Static brand assets, SVG icons, illustrations
│   │
│   ├── components/         # Domain-agnostic reusable UI component library
│   │   ├── ui/             # Atomic components: Button, Input, Modal, Badge, Card, Spinner
│   │   ├── feedback/       # Toast alert, EmptyState, SkeletonLoader, ErrorBanner
│   │   └── navigation/     # Navbar, Footer, Breadcrumbs, PaginationControls
│   │
│   ├── features/           # Domain-driven feature slices
│   │   ├── auth/           # Login, Register, OTP verification, ForgotPassword forms
│   │   ├── catalog/        # ProductGrid, ProductCard, FilterSidebar, VariantSelector
│   │   ├── cart/           # CartDrawer, CartItemRow, CartSummary
│   │   ├── checkout/       # AddressSelector, CouponForm, OrderSummary, PaymentMethodPicker
│   │   ├── orders/         # OrderCard, OrderTimeline, InvoiceDownloadButton, ReturnModal
│   │   ├── wallet/         # WalletBalanceWidget, TransactionHistoryTable
│   │   └── admin/          # SalesBarChart, ProductManageTable, OrderStatusDropdown
│   │
│   ├── hooks/              # Global reusable React hooks
│   │   ├── useDebounce.js  # Debounces search input queries to prevent API spam
│   │   ├── usePagination.js# Computes pagination offsets and page numbers
│   │   └── useDisclosure.js# Toggles modals, drawers, and popovers cleanly
│   │
│   ├── layouts/            # Page shell layouts
│   │   ├── MainLayout.jsx  # Customer layout with persistent Navbar and Footer
│   │   ├── AuthLayout.jsx  # Centered card layout for Login / Register
│   │   ├── AdminLayout.jsx # Dashboard layout with Admin Sidebar and Topbar
│   │   └── AccountLayout.jsx# Customer profile layout with sidebar tabs
│   │
│   ├── pages/              # Page route entry points (compose features and layouts)
│   │   ├── HomePage.jsx
│   │   ├── ShopPage.jsx
│   │   ├── ProductDetailPage.jsx
│   │   ├── CartPage.jsx
│   │   ├── CheckoutPage.jsx
│   │   ├── OrderSuccessPage.jsx
│   │   ├── OrderFailurePage.jsx
│   │   ├── MyOrdersPage.jsx
│   │   ├── OrderDetailPage.jsx
│   │   ├── ProfilePage.jsx
│   │   ├── WalletPage.jsx
│   │   └── admin/
│   │       ├── AdminDashboardPage.jsx
│   │       ├── AdminProductsPage.jsx
│   │       ├── AdminOrdersPage.jsx
│   │       └── AdminCouponsPage.jsx
│   │
│   ├── services/           # HTTP communication layer
│   │   ├── api.js          # Axios instance with baseURL, credentials, and response interceptors
│   │   ├── authService.js
│   │   ├── productService.js
│   │   ├── cartService.js
│   │   ├── checkoutService.js
│   │   ├── orderService.js
│   │   ├── walletService.js
│   │   └── adminService.js
│   │
│   ├── store/              # Redux Toolkit centralized state
│   │   ├── index.js        # Configures Redux store
│   │   ├── authSlice.js    # Current user, authentication status, role
│   │   ├── cartSlice.js    # Cart badge count, cart drawer open/close
│   │   └── uiSlice.js      # Global toast notifications, active global modals
│   │
│   ├── utils/              # Utility helper functions
│   │   ├── formatCurrency.js # Formats numbers to Indian Rupee (₹)
│   │   ├── formatDate.js     # Human-readable date parsing
│   │   └── errorParser.js    # Extracts user-friendly messages from API errors
│   │
│   └── validators/         # Client-side Zod schemas matching backend schemas
│       ├── authSchemas.js
│       ├── addressSchemas.js
│       └── checkoutSchemas.js
│
├── tailwind.config.js      # Tailwind CSS theme configuration and tokens
└── vite.config.js          # Vite configuration with path aliases (@/ -> src/)
```

---

## 3. State Management Boundary: What Goes in Redux vs Local State

A major anti-pattern in beginner React applications is dumping **all** state into Redux (e.g. form input values, modal visibility, search keywords, or fetched product lists). This causes massive unnecessary component re-renders and bloated boilerplate.

### State Boundary Decision Matrix

| State Category | Where It Lives | Justification |
| :--- | :--- | :--- |
| **Authenticated User Profile & Role** | **Redux Toolkit** (`authSlice`) | Needed globally by Navbar, route guards (`ProtectedRoute`), checkout buttons, and profile menus across the entire application lifecycle. |
| **Global Cart Counter & Drawer Visibility** | **Redux Toolkit** (`cartSlice`) | Navbar badge count must update immediately regardless of which page the user is browsing; drawer can be triggered from product cards. |
| **Global Toasts / Notifications** | **Redux Toolkit** (`uiSlice`) | Any API failure or success toast must render uniformly on top of the UI viewport. |
| **Form Inputs (Login, Address, Checkout)** | **`react-hook-form` (Local)** | Uncontrolled form inputs avoid re-rendering the parent component on every keystroke; validated cleanly via Zod schema resolvers. |
| **Product Catalog Data & Filters** | **Local Page State (`useState`)** | Catalog results, active category filters, price sliders, and page numbers belong strictly to `ShopPage`. Other pages (e.g. Profile or Checkout) do not care about shop filters. |
| **Modal / Dialog Visibility** | **Local State (`useState` / hook)** | Opening a "Return Product" modal is isolated to that specific order card; storing it globally causes modal ID tracking bugs. |
| **Active Variant Selection (Size, Color)** | **Local Component State** | Belongs solely to the `ProductDetailPage` or `ProductCard` being actively viewed. |

---

## 4. API & Network Layer Standards

- **Axios Instance**: Configured with `withCredentials: true` to ensure the session cookie (`connect.sid`) is automatically attached to every outgoing request.
- **Interceptors**:
  - **Request Interceptor**: Can attach tracking headers or request timestamps.
  - **Response Interceptor**: Centrally inspects error responses. If an API returns `401 Unauthorized` on a protected route, it automatically dispatches `logout()` to the Redux store and routes the user to `/login`.
