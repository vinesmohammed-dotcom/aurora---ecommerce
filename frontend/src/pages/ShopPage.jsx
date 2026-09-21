import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

export default function ShopPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Product Catalog</h1>
          <p className="text-sm text-slate-500">Catalog browsing, search, and variant filtering foundation.</p>
        </div>
        <Badge variant="default">Phase 3 Target</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="space-y-4">
            <div className="aspect-[4/5] bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-medium text-xs">
              Product Variant Image Placeholder
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-600">IN STOCK</p>
              <h4 className="font-semibold text-slate-900 mt-1">Catalog Item #{i}</h4>
              <p className="text-sm text-slate-600 mt-1">₹4,999</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
