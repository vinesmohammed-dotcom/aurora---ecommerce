import React from "react";
import { useSelector } from "react-redux";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import AddressList from "../features/addresses/AddressList";
import { useLogout } from "../features/auth/useLogout";

export default function ProfilePage() {
  const { user } = useSelector((state) => state.auth);
  const { handleLogout } = useLogout();

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Account Overview</h1>
          <p className="text-sm text-slate-500">Manage your profile information and saved addresses.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={user?.role === "ADMIN" ? "primary" : "info"}>
            {user?.role || "CUSTOMER"}
          </Badge>
          <button
            type="button"
            onClick={() => handleLogout()}
            className="text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card>
            <div className="space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xl">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{user?.name || "Customer"}</h3>
                <p className="text-xs text-slate-500">{user?.email || "No email"}</p>
              </div>
              <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 space-y-1">
                <p>Status: <span className="font-semibold text-emerald-600">Active</span></p>
                <p>Verified: <span className="font-semibold text-slate-700">{user?.isVerified ? "Yes" : "Pending"}</span></p>
              </div>

              {/* Customer Referral Code Card */}
              {user?.referralCode && (
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Your Referral Code</span>
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Earn ₹100
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-center font-mono font-bold text-sm text-indigo-700 tracking-wider select-all border border-slate-200">
                      {user.referralCode}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(user.referralCode);
                        alert(`Referral code ${user.referralCode} copied to clipboard!`);
                      }}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600 transition cursor-pointer"
                      title="Copy code"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Give ₹100, Get ₹100. When friends sign up with your code, both of you earn wallet credits.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="md:col-span-2">
          <AddressList />
        </div>
      </div>
    </div>
  );
}
