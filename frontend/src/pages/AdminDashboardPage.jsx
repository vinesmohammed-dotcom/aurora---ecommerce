import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Admin Control Center</h1>
          <p className="text-sm text-slate-500">Catalog management, sales analytics, and fulfillment controls.</p>
        </div>
        <Badge variant="warning">Admin Restricted</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card><p className="text-sm font-medium text-slate-500">Gross Revenue</p><p className="text-2xl font-bold font-heading text-slate-900 mt-2">₹0.00</p></Card>
        <Card><p className="text-sm font-medium text-slate-500">Total Orders</p><p className="text-2xl font-bold font-heading text-slate-900 mt-2">0</p></Card>
        <Card><p className="text-sm font-medium text-slate-500">Active Products</p><p className="text-2xl font-bold font-heading text-slate-900 mt-2">0</p></Card>
        <Card><p className="text-sm font-medium text-slate-500">Pending Returns</p><p className="text-2xl font-bold font-heading text-slate-900 mt-2">0</p></Card>
      </div>
    </div>
  );
}
