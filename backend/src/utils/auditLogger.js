/**
 * Financial and Administrative Audit Logger
 *
 * Implements structured audit logging for high-impact financial operations:
 * - ADMIN_APPROVED_RETURN
 * - ADMIN_REJECTED_RETURN
 * - ADMIN_INITIATED_REFUND
 * - ADMIN_WALLET_CREDIT
 * - ADMIN_WALLET_DEBIT
 *
 * Security Guarantee:
 * Strictly filters out passwords, OTPs, Razorpay secrets, session secrets, and credentials.
 */

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "otp",
  "secret",
  "razorpay_key_secret",
  "razorpay_webhook_secret",
  "cookie",
  "authorization",
  "session",
  "token"
];

function sanitizeMetadata(obj) {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMetadata(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object") {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class AuditLogger {
  static logFinancialAction({
    action,
    adminId,
    targetUserId = null,
    orderId = null,
    paymentId = null,
    amountPaise = null,
    reason = "",
    metadata = {}
  }) {
    const event = {
      timestamp: new Date().toISOString(),
      eventType: "FINANCIAL_AUDIT",
      action,
      adminId: adminId ? adminId.toString() : null,
      targetUserId: targetUserId ? targetUserId.toString() : null,
      orderId: orderId ? orderId.toString() : null,
      paymentId: paymentId ? paymentId.toString() : null,
      amountPaise: typeof amountPaise === "number" ? Math.round(amountPaise) : null,
      amountRupees: typeof amountPaise === "number" ? (amountPaise / 100).toFixed(2) : null,
      reason: reason ? String(reason).trim() : null,
      metadata: sanitizeMetadata(metadata)
    };

    console.log(`[AUDIT] ${JSON.stringify(event)}`);
    return event;
  }
}

module.exports = AuditLogger;
