import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";

export default function WishlistPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">My Wishlist</h1>
          <p className="text-sm text-slate-500">Saved favorite items for fast future checkout.</p>
        </div>
        <Badge variant="default">Wishlist Module</Badge>
      </div>
      <Card>
        <div className="text-center py-8 text-slate-500 text-sm">
          Your wishlist is currently empty.
        </div>
      </Card>
    </div>
  );
}
