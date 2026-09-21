import React from "react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { Link } from "react-router-dom";

export default function CartPage() {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card>
        <div className="space-y-4 text-center py-6">
          <Badge variant="default">Cart Foundation</Badge>
          <h2 className="text-2xl font-bold font-heading text-slate-900">Your Shopping Cart</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Server-verified cart state, dynamic price reconciliation, and atomic stock reservation will be active in later phases.
          </p>
          <div className="pt-4">
            <Link to="/shop">
              <Button variant="primary">Return to Catalog</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
