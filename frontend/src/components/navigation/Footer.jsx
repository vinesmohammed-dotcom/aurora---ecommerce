import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Truck, RotateCcw, CreditCard, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      {/* Trust Highlights Bar */}
      <div className="border-b border-slate-100 bg-slate-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Free Express Delivery</p>
                <p className="text-[11px] text-slate-500">On all domestic orders over ₹999</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">100% Verified Authentic</p>
                <p className="text-[11px] text-slate-500">Directly sourced brand catalog</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">7-Day Easy Returns</p>
                <p className="text-[11px] text-slate-500">Instant wallet or source refunds</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Secure Payments</p>
                <p className="text-[11px] text-slate-500">PCI-DSS encrypted via Razorpay</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-sm">
                A
              </div>
              <span className="text-base font-extrabold font-heading text-slate-900 tracking-tight">
                AURORA
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Curated luxury fashion and lifestyle storefront built with full-stack transactional integrity, verified reviews, and instant refunds.
            </p>
            <div className="pt-2 text-[11px] text-slate-400">
              Bangalore Logistics Hub • ISO 27001 Certified
            </div>
          </div>

          {/* Catalog Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Explore Catalog</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <Link to="/shop" className="hover:text-indigo-600 transition">
                  All Products
                </Link>
              </li>
              <li>
                <Link to="/shop?sort=newest" className="hover:text-indigo-600 transition">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link to="/shop?inStock=true" className="hover:text-indigo-600 transition">
                  In-Stock Items
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="hover:text-indigo-600 transition">
                  Saved Wishlist
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Customer Concierge</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <Link to="/orders" className="hover:text-indigo-600 transition">
                  Track & Manage Orders
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="hover:text-indigo-600 transition">
                  Return & Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/shipping-policy" className="hover:text-indigo-600 transition">
                  Shipping & Delivery
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-indigo-600 transition">
                  Help & FAQs
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-indigo-600 transition">
                  Contact Support Desk
                </Link>
              </li>
            </ul>
          </div>

          {/* Governance & Trust Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Legal & Governance</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <Link to="/privacy" className="hover:text-indigo-600 transition">
                  Privacy & Cookies Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-indigo-600 transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/wallet" className="hover:text-indigo-600 transition">
                  Customer Wallet Ledger
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-indigo-600 transition">
                  Security & Account Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Aurora Storefront. All rights reserved. GST Registered.</p>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/privacy" className="hover:text-slate-900 transition">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-slate-900 transition">
              Terms
            </Link>
            <Link to="/shipping-policy" className="hover:text-slate-900 transition">
              Shipping
            </Link>
            <Link to="/refund-policy" className="hover:text-slate-900 transition">
              Refunds
            </Link>
            <Link to="/contact" className="hover:text-slate-900 transition">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
