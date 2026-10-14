import React from "react";
import Card from "../components/ui/Card";
import { RotateCcw, XCircle, CreditCard, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function RefundPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
          Cancellation, Return & Refund Policy
        </h1>
        <p className="text-sm text-slate-500">
          Last updated: October 2026. Explicit consumer rights and lifecycle state machine.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 border-l-4 border-l-rose-500 text-center">
          <XCircle className="h-6 w-6 text-rose-500 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Pre-Dispatch Cancel</h3>
          <p className="text-xs text-slate-500 mt-1">Cancel anytime before courier handover</p>
        </Card>
        <Card className="p-5 border-l-4 border-l-amber-500 text-center">
          <RotateCcw className="h-6 w-6 text-amber-500 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">7-Day Returns</h3>
          <p className="text-xs text-slate-500 mt-1">Hassle-free return window upon delivery</p>
        </Card>
        <Card className="p-5 border-l-4 border-l-emerald-600 text-center">
          <CreditCard className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Guaranteed Refund</h3>
          <p className="text-xs text-slate-500 mt-1">Instant to Wallet or 5–7 days to source</p>
        </Card>
      </div>

      <Card className="p-6 sm:p-8 border border-slate-200 space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">1. Order Cancellation Policy</h2>
          <p>
            Customers may cancel any eligible order directly through the <strong>Orders</strong> portal before courier dispatch:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
            <li><strong>Permitted Statuses:</strong> Orders in <span className="font-semibold text-slate-800">Pending, Confirmed, or Processing</span> status may be cancelled instantly with a stated reason.</li>
            <li><strong>Non-Cancellable Statuses:</strong> Once an order transitions to <span className="font-semibold text-slate-800">Shipped or Delivered</span>, it cannot be cancelled mid-transit. You may instead initiate a 7-day return after delivery.</li>
            <li><strong>Payment Handling:</strong> For prepaid orders (Razorpay/Wallet), cancellation initiates an immediate refund workflow back to your original payment channel or wallet ledger.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">2. 7-Day Return Eligibility & State Transitions</h2>
          <p>
            Delivered products are eligible for return within 7 calendar days of delivery date. All returns adhere to our structured return state machine:
          </p>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 font-mono text-xs text-slate-800">
            <p>1. <strong>RETURN_REQUESTED:</strong> Customer files request with reason from Order Details.</p>
            <p>2. <strong>RETURN_APPROVED:</strong> Admin validates request eligibility and dispatches pickup courier.</p>
            <p>3. <strong>RETURN_RECEIVED:</strong> Logistics hub receives package.</p>
            <p>4. <strong>RETURN_INSPECTED:</strong> Warehouse performs quality inspection.</p>
            <p>5. <strong>RETURNED / REFUNDED:</strong> Sellable inventory is restocked and payment refunded.</p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">3. Return Inspection & Inventory Restocking</h2>
          <p>
            To protect product integrity, all returned items undergo physical warehouse inspection:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
            <li><strong>Passed Inspection:</strong> Items in original, unused condition with tags and packaging intact are approved and restocked to sellable inventory.</li>
            <li><strong>Damaged / Used Items:</strong> Products showing signs of wear, missing tags, or customer damage are rejected or routed to damaged salvage, and will NOT be restored to active inventory.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">4. Refund Methods & Timelines</h2>
          <p>
            Approved refunds are credited according to the chosen destination:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200">
              <p className="font-bold text-emerald-900">Aurora Customer Wallet</p>
              <p className="text-xs text-emerald-700 mt-1">
                <strong>Instant Credit:</strong> Immediately available for new orders or checkout deductions.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-indigo-50/60 border border-indigo-200">
              <p className="font-bold text-indigo-900">Original Gateway Source (Razorpay)</p>
              <p className="text-xs text-indigo-700 mt-1">
                <strong>5 to 7 Business Days:</strong> Dependent upon the issuing banking network and card network settlement.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">5. Non-Refundable Items</h2>
          <p>
            Gift cards, promotional coupon values, and items explicitly marked as "Final Sale" cannot be refunded.
          </p>
        </section>
      </Card>
    </div>
  );
}
