import React from "react";
import Card from "../components/ui/Card";
import { ShieldCheck, Lock, Eye, Database } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
          Privacy & Data Protection Policy
        </h1>
        <p className="text-sm text-slate-500">
          Last updated: October 2026. How Aurora collects, secures, and handles customer data.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 border-l-4 border-l-indigo-600 text-center">
          <Lock className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">TLS Encryption</h3>
          <p className="text-xs text-slate-500 mt-1">End-to-end encrypted sessions and API traffic</p>
        </Card>
        <Card className="p-5 border-l-4 border-l-emerald-600 text-center">
          <Eye className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">No Data Selling</h3>
          <p className="text-xs text-slate-500 mt-1">We never sell your data to third-party brokers</p>
        </Card>
        <Card className="p-5 border-l-4 border-l-amber-600 text-center">
          <Database className="h-6 w-6 text-amber-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Server Security</h3>
          <p className="text-xs text-slate-500 mt-1">Hashed passwords and tokenized gateway auth</p>
        </Card>
      </div>

      <Card className="p-6 sm:p-8 border border-slate-200 space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">1. Information We Collect</h2>
          <p>
            When you register an account, browse products, or execute an order on Aurora, we collect:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-700">
            <li><strong>Account Identity:</strong> Full name, verified email address, phone number, and bcrypt-salted password hashes.</li>
            <li><strong>Shipping Coordinates:</strong> Street address, city, state, postal pincode, and delivery instructions.</li>
            <li><strong>Transaction Records:</strong> Order numbers, gateway transaction IDs, and invoice summaries. We do NOT store credit card numbers, CVVs, or Net Banking PINs on our servers.</li>
            <li><strong>Session & Diagnostics:</strong> Essential HTTP-only cookies, IP address, and browser user-agent for authentication and fraud prevention.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">2. How Your Information is Utilized</h2>
          <p>
            Customer data is strictly utilized to process orders, generate compliant invoices, deliver tracking notifications, manage refunds/wallets, and provide customer support.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">3. Authentication & Cookie Usage</h2>
          <p>
            Aurora employs secure HTTP-only cookies backed by server-side MongoDB session stores. This protects your session tokens against cross-site scripting (XSS) and session fixation exploits.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">4. Third-Party Integrations</h2>
          <p>
            We interface with trusted third-party providers strictly for fulfillment and payment processing:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
            <li><strong>Razorpay:</strong> Secure PCI-DSS compliant checkout and refund processing.</li>
            <li><strong>Google Identity Services:</strong> Verified OAuth 2.0 Single Sign-On.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold font-heading text-slate-900">5. Data Deletion & Privacy Rights</h2>
          <p>
            Customers retain the right to inspect, correct, or request deletion of their account records. Inquiries can be submitted directly via our <a href="/contact" className="text-indigo-600 underline">Contact Page</a> or by writing to <a href="mailto:privacy@aurora.local" className="text-indigo-600 underline">privacy@aurora.local</a>.
          </p>
        </section>
      </Card>
    </div>
  );
}
