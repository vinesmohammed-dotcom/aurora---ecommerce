import React from "react";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between text-sm text-slate-500">
        <p>© {new Date().getFullYear()} Aurora Storefront. Phase 1 Architecture Foundation.</p>
        <div className="flex space-x-6 mt-4 sm:mt-0">
          <span className="hover:text-slate-900 cursor-pointer">Privacy</span>
          <span className="hover:text-slate-900 cursor-pointer">Terms</span>
          <span className="hover:text-slate-900 cursor-pointer">Support</span>
        </div>
      </div>
    </footer>
  );
}
