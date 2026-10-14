import React from "react";
import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import AdminLayout from "../layouts/AdminLayout";
import AdminRoute from "../components/auth/AdminRoute";

// Customer Storefront Pages
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ShopPage from "../pages/ShopPage";
import ProductDetailPage from "../pages/ProductDetailPage";
import CartPage from "../pages/CartPage";
import WishlistPage from "../pages/WishlistPage";
import ProfilePage from "../pages/ProfilePage";
import OrdersPage from "../pages/OrdersPage";
import WalletPage from "../pages/WalletPage";
import CheckoutPage from "../features/checkout/CheckoutPage";
import PaymentSuccessPage from "../pages/PaymentSuccessPage";
import PaymentFailurePage from "../pages/PaymentFailurePage";
import NotFoundPage from "../pages/NotFoundPage";

// Customer Help, Support & Trust Policy Pages
import ContactPage from "../pages/ContactPage";
import FaqPage from "../pages/FaqPage";
import ShippingPolicyPage from "../pages/ShippingPolicyPage";
import RefundPolicyPage from "../pages/RefundPolicyPage";
import PrivacyPolicyPage from "../pages/PrivacyPolicyPage";
import TermsPage from "../pages/TermsPage";

// Lazy-Loaded Admin Management Pages (Code-Splitting Boundary)
const AdminDashboardPage = React.lazy(() => import("../pages/admin/AdminDashboardPage"));
const AdminReportsPage = React.lazy(() => import("../pages/admin/AdminReportsPage"));
const AdminProductsPage = React.lazy(() => import("../pages/admin/AdminProductsPage"));
const AdminInventoryPage = React.lazy(() => import("../pages/admin/AdminInventoryPage"));
const AdminCategoriesPage = React.lazy(() => import("../pages/admin/AdminCategoriesPage"));
const AdminBrandsPage = React.lazy(() => import("../pages/admin/AdminBrandsPage"));
const AdminOrdersPage = React.lazy(() => import("../pages/admin/AdminOrdersPage"));
const AdminReturnsPage = React.lazy(() => import("../pages/admin/AdminReturnsPage"));
const AdminRefundsPage = React.lazy(() => import("../pages/admin/AdminRefundsPage"));
const AdminWalletsPage = React.lazy(() => import("../pages/admin/AdminWalletsPage"));
const AdminOffersPage = React.lazy(() => import("../pages/admin/AdminOffersPage"));
const AdminCouponsPage = React.lazy(() => import("../pages/admin/AdminCouponsPage"));
const AdminUsersPage = React.lazy(() => import("../pages/admin/AdminUsersPage"));
const AdminAuditLogsPage = React.lazy(() => import("../pages/admin/AdminAuditLogsPage"));
const AdminReviewsPage = React.lazy(() => import("../pages/admin/AdminReviewsPage"));

/**
 * Application Route Tree
 * Partitioned into Customer Storefront (MainLayout) and Administrator Control Plane (AdminRoute + AdminLayout).
 */
export const router = createBrowserRouter([
  // Public & Customer Routes
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "shop", element: <ShopPage /> },
      { path: "products", element: <ShopPage /> },
      { path: "products/:slug", element: <ProductDetailPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "wishlist", element: <WishlistPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "wallet", element: <WalletPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "payment-success", element: <PaymentSuccessPage /> },
      { path: "payment-failure", element: <PaymentFailurePage /> },
      { path: "orders", element: <OrdersPage /> },
      { path: "contact", element: <ContactPage /> },
      { path: "faq", element: <FaqPage /> },
      { path: "shipping-policy", element: <ShippingPolicyPage /> },
      { path: "refund-policy", element: <RefundPolicyPage /> },
      { path: "privacy", element: <PrivacyPolicyPage /> },
      { path: "terms", element: <TermsPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  },

  // Protected Admin Routes
  {
    path: "/admin",
    element: <AdminRoute />,
    errorElement: <NotFoundPage />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: "reports", element: <AdminReportsPage /> },
          { path: "products", element: <AdminProductsPage /> },
          { path: "inventory", element: <AdminInventoryPage /> },
          { path: "categories", element: <AdminCategoriesPage /> },
          { path: "brands", element: <AdminBrandsPage /> },
          { path: "orders", element: <AdminOrdersPage /> },
          { path: "returns", element: <AdminReturnsPage /> },
          { path: "refunds", element: <AdminRefundsPage /> },
          { path: "wallets", element: <AdminWalletsPage /> },
          { path: "offers", element: <AdminOffersPage /> },
          { path: "coupons", element: <AdminCouponsPage /> },
          { path: "users", element: <AdminUsersPage /> },
          { path: "audit-logs", element: <AdminAuditLogsPage /> },
          { path: "reviews", element: <AdminReviewsPage /> }
        ]
      }
    ]
  }
]);
