import React from "react";
import Card from "../components/ui/Card";
import { Truck, Clock, ShieldCheck, MapPin, AlertCircle } from "lucide-react";

export default function ShippingPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
          Shipping & Delivery Policy
        </h1>
        <p className="text-sm text-slate-500">
          Last updated: October 2026. Standard transit schedules and fulfillment standards.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 border-l-4 border-l-indigo-600 text-center">
          <Truck className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Free Shipping</h3>
          <p className="text-xs text-slate-500 mt-1">On all domestic orders above ₹999</p>
        </Card>
        <Card className="p-5 border-l-4 border-l-emerald-600 text-center">
          <Clock className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Dispatch Speed</h3>
          <p className="text-xs text-slate-500 mt-1">Dispatched within 24 to 48 business hours</p>
        </Card>
        <Card className="p-5 border-l-4 border-l-amber-600 text-center">
          <ShieldCheck className="h-6 w-6 text-amber-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Verified Couriers</h3>
          <p className="text-xs text-slate-500 mt-1">Tamper-evident luxury packaging</p>
        </Card>
      </div>

      <Card className="p-6 sm:p-8 border border-slate-200 space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">1. Order Processing & Dispatch</h2>
          <p>
            All catalog orders placed on Aurora are verified against live warehouse inventory. Once payment is confirmed (or COD order validated), orders are processed and handed over to logistics partners within 24 to 48 hours, excluding Sundays and gazetted national holidays.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">2. Estimated Delivery Timelines</h2>
          <p>
            Delivery timeframes vary based on recipient postal pincode:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
            <li><strong>Tier 1 Metro Cities (Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata):</strong> 2 to 3 business days.</li>
            <li><strong>Tier 2 & Other Urban Hubs:</strong> 3 to 5 business days.</li>
            <li><strong>Remote & Northeast Regions:</strong> 5 to 7 business days.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">3. Shipping Fee Structure</h2>
          <p>
            Our pricing is server-authoritative and transparent:
          </p>
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-1">
            <p>• <strong>Orders ₹999 and above:</strong> FREE Shipping across India.</p>
            <p>• <strong>Orders below ₹999:</strong> Flat ₹99 delivery and packaging fee applied automatically at checkout.</p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">4. Tracking & Delivery Attempts</h2>
          <p>
            Customers receive milestone status updates directly on their <strong>Orders</strong> page. Our courier partners will attempt delivery up to three (3) times before returning the shipment to origin (RTO).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">5. Undelivered or Damaged Shipments</h2>
          <p>
            In the rare event that a package appears tampered or damaged upon arrival, please refuse delivery and contact our support desk immediately at <a href="mailto:support@aurora.local" className="text-indigo-600 underline">support@aurora.local</a> with your order number.
          </p>
        </section>
      </Card>
    </div>
  );
}
