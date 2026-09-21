import React from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { toggleCartDrawer } from "../../store/slices/cartSlice";

export default function Navbar() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const { itemCount } = useSelector((state) => state.cart);

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
          {user?.role === "ADMIN" && (
            <Link to="/admin" className="text-emerald-600 hover:text-emerald-700 font-semibold">
              Admin Portal
            </Link>
          )}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center space-x-4">
          <Link
            to="/cart"
            onClick={() => dispatch(toggleCartDrawer())}
            className="relative p-2 text-slate-600 hover:text-slate-900"
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
            <Link
              to="/profile"
              className="text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5"
            >
              {user?.name || "Account"}
            </Link>
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
