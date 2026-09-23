import React, { useState } from "react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

const AUDIT_ACTIONS = [
  {
    action: "ADMIN_INITIATED_REFUND",
    category: "Payment Gateway",
    severity: "CRITICAL",
    description: "Administrator dispatches an external financial refund to Razorpay for a captured payment.",
    samplePayload: {
      timestamp: "2026-09-23T09:53:10.111Z",
      eventType: "FINANCIAL_AUDIT",
      action: "ADMIN_INITIATED_REFUND",
      adminId: "6ab3a183f8e8d38ca6e16851",
      targetUserId: "6ab3a184f8e8d38ca6e16854",
      orderId: "6ab3a186f8e8d38ca6e168ef",
      paymentId: "6ab3a186f8e8d38ca6e168f2",
      amountPaise: 200000,
      amountRupees: "2000.00",
      reason: "Approved return refund",
      metadata: {
        refundNumber: "REF-MUDXDC5Z-5824",
        gatewayRefundId: "rfnd_mudxdc61_gyqepu",
        refundType: "FULL"
      }
    }
  },
  {
    action: "ADMIN_WALLET_CREDIT",
    category: "Internal Ledger",
    severity: "HIGH",
    description: "Administrator adds stored-value funds to a customer wallet with append-only ledger transaction.",
    samplePayload: {
      timestamp: "2026-09-23T09:53:19.388Z",
      eventType: "FINANCIAL_AUDIT",
      action: "ADMIN_WALLET_CREDIT",
      adminId: "6ab3a18d5934361cf3b61064",
      targetUserId: "6ab3a18e5934361cf3b6106a",
      orderId: null,
      paymentId: null,
      amountPaise: 100000,
      amountRupees: "1000.00",
      reason: "Customer goodwill compensation",
      metadata: {
        referenceId: "admin_cr_1790157199382_jq955u"
      }
    }
  },
  {
    action: "ADMIN_WALLET_DEBIT",
    category: "Internal Ledger",
    severity: "HIGH",
    description: "Administrator debits stored funds from customer balance with verification of non-negative balance.",
    samplePayload: {
      timestamp: "2026-09-23T09:53:19.410Z",
      eventType: "FINANCIAL_AUDIT",
      action: "ADMIN_WALLET_DEBIT",
      adminId: "6ab3a18d5934361cf3b61064",
      targetUserId: "6ab3a18e5934361cf3b6106a",
      orderId: null,
      paymentId: null,
      amountPaise: 30000,
      amountRupees: "300.00",
      reason: "Manual correction of duplicate promotion",
      metadata: {
        referenceId: "admin_dr_1790157199401_5z7crr"
      }
    }
  },
  {
    action: "ADMIN_APPROVED_RETURN",
    category: "Order RMA",
    severity: "MEDIUM",
    description: "Administrator reviews customer return request and issues Return Merchandise Authorization (RMA).",
    samplePayload: {
      timestamp: "2026-09-23T09:53:10.042Z",
      eventType: "FINANCIAL_AUDIT",
      action: "ADMIN_APPROVED_RETURN",
      adminId: "6ab3a183f8e8d38ca6e16851",
      targetUserId: "6ab3a184f8e8d38ca6e16854",
      orderId: "6ab3a186f8e8d38ca6e168ef",
      paymentId: null,
      amountPaise: null,
      amountRupees: null,
      reason: "Return request approved by administrator",
      metadata: {
        orderNumber: "ORD-REF-MUDXDC38-5628"
      }
    }
  },
  {
    action: "ADMIN_USER_SUSPENDED",
    category: "Access Governance",
    severity: "HIGH",
    description: "Administrator suspends user account, immediately invalidating active auth sessions.",
    samplePayload: {
      timestamp: "2026-09-23T10:14:02.821Z",
      eventType: "SECURITY_AUDIT",
      action: "ADMIN_USER_SUSPENDED",
      adminId: "6ab3a183f8e8d38ca6e16851",
      targetUserId: "6ab3a184f8e8d38ca6e16899",
      orderId: null,
      paymentId: null,
      amountPaise: null,
      amountRupees: null,
      reason: "Policy violation: excessive fraudulent checkout attempts",
      metadata: {
        isBlocked: true,
        previousState: "ACTIVE"
      }
    }
  }
];

const REDACTED_KEYS = [
  "password",
  "passwordHash",
  "otp",
  "secret",
  "razorpay_key_secret",
  "razorpay_webhook_secret",
  "cookie",
  "authorization",
  "session",
  "token"
];

export default function AdminAuditLogsPage() {
  const [selectedAction, setSelectedAction] = useState(AUDIT_ACTIONS[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(selectedAction.samplePayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">
          Security & Financial Audit Infrastructure
        </h1>
        <p className="text-sm text-slate-500">
          Architecture, stream taxonomy, and data redaction specifications governing immutable financial event logging.
        </p>
      </div>

      {/* 12-Factor Architecture Clarification */}
      <Card className="p-6 bg-slate-900 text-slate-300 border-none space-y-3">
        <div className="flex items-center space-x-2 text-emerald-400 font-semibold font-mono text-xs uppercase tracking-wider">
          <span>🛡️ 12-Factor Event Stream Architecture</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          In strict compliance with <strong>12-Factor App Section XI (Logs as event streams)</strong>, audit trails are emitted as structured, NDJSON-formatted events to standard output (<code>stdout</code>) rather than being persisted into mutable, application-tier database tables. In production deployments, these streams are ingested by container daemons into centralized, write-once archival sinks (e.g., AWS CloudWatch Logs, Datadog, or Elastic).
        </p>
        <div className="text-xs text-slate-400 font-mono bg-slate-950/70 p-3 rounded-lg border border-slate-800">
          [AUDIT] {JSON.stringify({ timestamp: "2026-09-23T09:53:10.111Z", eventType: "FINANCIAL_AUDIT", action: "...", adminId: "..." })}
        </div>
      </Card>

      {/* Redaction Security Policy */}
      <Card className="p-6 border border-slate-200">
        <h2 className="text-base font-bold font-heading text-slate-900 mb-2">
          Automated Data Sanitization & Zero-Leakage Policy
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          All payload metadata traverses <code>sanitizeMetadata()</code> in <code>backend/src/utils/auditLogger.js</code> prior to emission, irreversibly replacing sensitive tokens with <code>[REDACTED]</code>.
        </p>

        <div className="flex flex-wrap gap-2">
          {REDACTED_KEYS.map((k) => (
            <span
              key={k}
              className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-1"
            >
              <span>🔒</span>
              <span>{k}</span>
            </span>
          ))}
        </div>
      </Card>

      {/* Interactive Audit Action Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Action Directory */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 font-mono">
            Audited Event Types
          </h2>
          {AUDIT_ACTIONS.map((item) => (
            <button
              key={item.action}
              type="button"
              onClick={() => setSelectedAction(item)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedAction.action === item.action
                  ? "bg-emerald-50/80 border-emerald-500 text-emerald-950 shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold">{item.action}</span>
                <Badge
                  variant={
                    item.severity === "CRITICAL"
                      ? "danger"
                      : item.severity === "HIGH"
                      ? "warning"
                      : "info"
                  }
                  className="text-[10px]"
                >
                  {item.severity}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
            </button>
          ))}
        </div>

        {/* Right Column: Structured Payload Viewer */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-mono">
                  {selectedAction.action}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Category: {selectedAction.category}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? "✓ Copied JSON" : "Copy Payload"}
              </Button>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto">
              <pre className="whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(selectedAction.samplePayload, null, 2)}
              </pre>

              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-sans">
                <span>Minor units: {selectedAction.samplePayload.amountPaise !== null ? `${selectedAction.samplePayload.amountPaise} paise` : "N/A"}</span>
                <span>Currency: INR</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
