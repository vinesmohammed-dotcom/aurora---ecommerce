import React from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { toggleCartDrawer } from "../../store/slices/cartSlice";
import { useLogout } from "../../features/auth/useLogout";

export default function Navbar() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const { itemCount } = useSelector((state) => state.cart);
  const { handleLogout } = useLogout();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <span className="text-xl font-extrabold tracking-tight text-slate-900 font-heading">
            AURORA<span className="text-emerald-500">.</span>
          </span>
        </Link>

        {/* Primary Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
          <Link to="/" className="hover:text-slate-900 transition-colors">
            Home
          </Link>
          <Link to="/shop" className="hover:text-slate-900 transition-colors">
            Shop
          </Link>
          <Link to="/orders" className="hover:text-slate-900 transition-colors">
            Orders
          </Link>
          <Link to="/wallet" className="hover:text-slate-900 transition-colors">
            Wallet
          </Link>
          {user?.role === "ADMIN" && (
            <Link to="/admin" className="text-emerald-600 hover:text-emerald-700 font-semibold">
              Admin Portal
            </Link>
          )}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <Link
            to="/wishlist"
            title="Wishlist"
            className="p-2 text-slate-600 hover:text-rose-600 transition-colors"
          >
            <span className="sr-only">Wishlist</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </Link>

          <Link
            to="/cart"
            title="Shopping Cart"
            className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span className="sr-only">Cart</span>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            {itemCount > 0 && (
              <span className="absolute top-1 right-1 bg-emerald-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <Link
                to="/profile"
                title={user?.name || "Account"}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 max-w-[120px] truncate"
              >
                {user?.name || "Account"}
              </Link>
              <button
                type="button"
                onClick={() => handleLogout()}
                className="text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg px-3 py-1.5 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-lg px-4 py-2 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
