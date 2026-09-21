import React from "react";
import { useSelector } from "react-redux";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import AddressList from "../features/addresses/AddressList";

export default function ProfilePage() {
  const { user } = useSelector((state) => state.auth);

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Account Overview</h1>
          <p className="text-sm text-slate-500">Manage your profile information and saved addresses.</p>
        </div>
        <Badge variant={user?.role === "ADMIN" ? "primary" : "info"}>
          {user?.role || "CUSTOMER"}
        </Badge>
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
