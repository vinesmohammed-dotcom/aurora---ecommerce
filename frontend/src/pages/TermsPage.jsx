import React from "react";
import Card from "../components/ui/Card";
import { FileText, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
          Terms & Conditions of Service
        </h1>
        <p className="text-sm text-slate-500">
          Last updated: October 2026. Governance of catalog transactions and platform access.
        </p>
      </div>

      <Card className="p-6 sm:p-8 border border-slate-200 space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">1. Acceptance of Terms</h2>
          <p>
            By accessing Aurora E-Commerce or completing purchases on our platform, you agree to be bound by these Terms of Service, along with our Privacy Policy, Shipping Policy, and Refund Policy. If you do not agree, you should discontinue platform usage.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">2. Customer Account Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials, passwords, and sessions. Any transactions or orders originating from your authenticated credentials will be deemed authorized by you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">3. Catalog Pricing & Server-Authoritative Billing</h2>
          <p>
            All prices displayed on product listings, shopping carts, and checkouts are denominated in Indian Rupees (INR) and include applicable GST unless otherwise stated. Aurora enforces server-authoritative pricing validation; client-side price tampering or stale pricing payloads will be rejected automatically before order creation.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">4. Inventory Reservations & Order Acceptance</h2>
          <p>
            Placing an item in your shopping cart does not reserve inventory. Inventory is atomically decremented upon order submission. In the event an item becomes depleted prior to payment completion, the order will fail gracefully with a stock alert and zero financial debit.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">5. Promotional Coupons & Referral Abuse</h2>
          <p>
            Coupons, referral bonuses, and promotional discounts are subject to individual usage quotas, expiration dates, and minimum spend thresholds. Self-referrals, automated coupon generation, or abuse of discount codes may result in order cancellation and suspension of platform access.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">6. Customer Reviews & Content Guidelines</h2>
          <p>
            Reviews and ratings posted by customers must reflect genuine personal purchase experience. Defamatory, fraudulent, spam, or promotional third-party content will be moderated or removed by our administrative integrity review team.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">7. Governing Law & Jurisdiction</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of India. Any legal disputes arising out of platform transactions shall be subject to the exclusive jurisdiction of the courts in Bangalore, Karnataka.
          </p>
        </section>
      </Card>
    </div>
  );
}
