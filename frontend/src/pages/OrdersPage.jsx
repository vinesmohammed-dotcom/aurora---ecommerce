import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Order History</h1>
          <p className="text-sm text-slate-500">Track and manage your previous orders and invoices.</p>
        </div>
        <Badge variant="info">Order State Machine</Badge>
      </div>
      <Card>
        <div className="text-center py-8 text-slate-500 text-sm">
          No orders placed yet. Order history and tracking timeline will be activated in the Checkout & Order phase.
        </div>
      </Card>
    </div>
  );
}
