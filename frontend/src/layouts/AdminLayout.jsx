import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { clearUser } from "../store/slices/authSlice";
import api from "../services/api";

const NAVIGATION_SECTIONS = [
  {
    title: "Executive",
    items: [
      { name: "Dashboard", path: "/admin", icon: "📊", end: true },
      { name: "Sales Reports", path: "/admin/reports", icon: "📈" }
    ]
  },
  {
    title: "Catalog",
    items: [
      { name: "Products & Variants", path: "/admin/products", icon: "🏷️" },
      { name: "Inventory Matrix", path: "/admin/inventory", icon: "📦" },
      { name: "Categories", path: "/admin/categories", icon: "📁" },
      { name: "Brands", path: "/admin/brands", icon: "🏢" }
    ]
  },
  {
    title: "Fulfillment",
    items: [
      { name: "Orders", path: "/admin/orders", icon: "🛍️" },
      { name: "Returns & Restock", path: "/admin/returns", icon: "🔄" }
    ]
  },
  {
    title: "Finances",
    items: [
      { name: "Gateway Refunds", path: "/admin/refunds", icon: "💳" },
      { name: "Customer Wallets", path: "/admin/wallets", icon: "👛" }
    ]
  },
  {
    title: "Promotions",
    items: [
      { name: "Special Offers", path: "/admin/offers", icon: "⚡" },
      { name: "Coupon Codes", path: "/admin/coupons", icon: "🎟️" }
    ]
  },
  {
    title: "Governance",
    items: [
      { name: "User Accounts", path: "/admin/users", icon: "👥" },
      { name: "Security Audit Logs", path: "/admin/audit-logs", icon: "🛡️" }
    ]
  }
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Proceed with client side clearing regardless
    } finally {
      dispatch(clearUser());
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-800">
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-30">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none"
            aria-label="Toggle Navigation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <span className="font-extrabold text-lg tracking-tight font-heading">
            AURORA <span className="text-emerald-400 text-xs px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 uppercase font-mono">Control</span>
          </span>
        </div>
        <Link
          to="/"
          className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1.5 rounded hover:bg-slate-700 transition"
        >
          Storefront &rarr;
        </Link>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col z-50 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80">
          <Link to="/admin" className="flex items-center space-x-2">
            <span className="text-xl font-extrabold tracking-tight text-white font-heading">
              AURORA<span className="text-emerald-400">.</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-emerald-400 uppercase bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded-full">
              Admin Ops
            </span>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6 text-sm">
          {NAVIGATION_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-all ${
                        isActive
                          ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                      }`
                    }
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Current User & Actions Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3">
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">{user?.name || "Administrator"}</div>
              <div className="text-[11px] text-slate-400 truncate">{user?.email || "admin@aurora.internal"}</div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded">
              {user?.role || "ADMIN"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              to="/"
              className="flex items-center justify-center space-x-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Return to Public Storefront"
            >
              <span>🛒 Store</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center space-x-1 py-1.5 rounded bg-rose-950/60 border border-rose-800/40 hover:bg-rose-900/60 text-rose-300 transition"
              title="Terminate Admin Session"
            >
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Control Bar (Desktop) */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200/80 px-8 items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center space-x-3 text-sm">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-slate-700 font-heading">E-Commerce Management Console</span>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500 font-mono">Phase 8 Portfolio Edition</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition"
            >
              <span>View Storefront</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Page Content Container with Suspense for Lazy-Loaded Admin Modules */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <React.Suspense
            fallback={
              <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 text-xs font-medium font-mono">Loading administrative view...</p>
              </div>
            }
          >
            <Outlet />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}
