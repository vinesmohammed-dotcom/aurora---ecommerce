import React from "react";
import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ShopPage from "../pages/ShopPage";
import CartPage from "../pages/CartPage";
import WishlistPage from "../pages/WishlistPage";
import ProfilePage from "../pages/ProfilePage";
import OrdersPage from "../pages/OrdersPage";
import AdminDashboardPage from "../pages/AdminDashboardPage";
import ProductDetailPage from "../pages/ProductDetailPage";
import AdminCategoriesPage from "../pages/admin/AdminCategoriesPage";
import AdminBrandsPage from "../pages/admin/AdminBrandsPage";
import AdminProductsPage from "../pages/admin/AdminProductsPage";
import NotFoundPage from "../pages/NotFoundPage";

/**
 * Application Route Tree
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "shop", element: <ShopPage /> },
      { path: "products/:slug", element: <ProductDetailPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "wishlist", element: <WishlistPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "orders", element: <OrdersPage /> },
      { path: "admin", element: <AdminDashboardPage /> },
      { path: "admin/categories", element: <AdminCategoriesPage /> },
      { path: "admin/brands", element: <AdminBrandsPage /> },
      { path: "admin/products", element: <AdminProductsPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
