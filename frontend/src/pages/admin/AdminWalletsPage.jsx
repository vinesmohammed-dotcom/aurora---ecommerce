import React, { useState, useEffect } from "react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import api from "../../services/api";
import { useScrollLock } from "../../hooks/useScrollLock";

export default function AdminWalletsPage() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [walletData, setWalletData] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [error, setError] = useState(null);

  // Modal State
  const [actionType, setActionType] = useState(null); // 'CREDIT' or 'DEBIT'
  const [amountRupees, setAmountRupees] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  useScrollLock(!!actionType);

  // Load customer users list for selection
  useEffect(() => {
    async function loadCustomers() {
      try {
        setLoadingUsers(true);
        const res = await api.get("/admin/users?limit=50&role=CUSTOMER");
        if (res.success && res.data) {
          setUsers(res.data.users || []);
          if (res.data.users.length > 0) {
            setSelectedUserId(res.data.users[0]._id);
          }
        }
      } catch (err) {
        setError(err.message || "Failed to load customers for wallet inspector");
      } finally {
        setLoadingUsers(false);
      }
    }
    loadCustomers();
  }, []);

  // Fetch wallet and ledger for selected user
  const fetchWallet = async (userId) => {
    if (!userId) return;
    try {
      setLoadingWallet(true);
      setError(null);
      const res = await api.get(`/admin/wallets/${userId}`);
      if (res.success && res.data) {
        setWalletData(res.data);
      } else {
        setWalletData(null);
        setError(res.message || "No wallet records found for this user.");
      }
    } catch (err) {
      setWalletData(null);
      setError(err.message || "Failed to retrieve wallet information");
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      fetchWallet(selectedUserId);
    }
  }, [selectedUserId]);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId || !actionType) return;

    const parsedRupees = parseFloat(amountRupees);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setActionError("Please provide a valid adjustment amount in Rupees greater than 0.");
      return;
    }

    if (reason.trim().length < 3) {
      setActionError("A valid administrative audit reason of at least 3 characters is mandatory.");
      return;
    }

    const amountPaise = Math.round(parsedRupees * 100);

    try {
      setSubmitting(true);
      setActionError("");
      const endpoint =
        actionType === "CREDIT"
          ? `/admin/wallets/${selectedUserId}/credit`
          : `/admin/wallets/${selectedUserId}/debit`;

      const res = await api.post(endpoint, {
        amount: amountPaise,
        reason: reason.trim()
      });

      if (res.success) {
        setActionSuccess(
          `Successfully ${actionType.toLowerCase()}ed ₹${parsedRupees.toFixed(2)} (${amountPaise} paise) to user wallet.`
        );
        setActionType(null);
        setAmountRupees("");
        setReason("");
        fetchWallet(selectedUserId);
      } else {
        setActionError(res.message || "Adjustment failed");
      }
    } catch (err) {
      setActionError(err.message || "Adjustment failed");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (paise) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const selectedUserObj = users.find((u) => u._id === selectedUserId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">
          Customer Wallets & Immutable Ledgers
        </h1>
        <p className="text-sm text-slate-500">
          Inspect customer stored-value balances, audit append-only transaction histories, and execute administrative credits/debits.
        </p>
      </div>

      {/* Accounting Invariant Architecture Alert */}
      <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs space-y-1 border border-slate-800">
        <div className="flex items-center space-x-2 text-emerald-400 font-semibold font-mono uppercase tracking-wider">
          <span>🏛️ Ledger Integrity Architecture</span>
        </div>
        <p className="text-slate-400">
          Wallet uses an immutable append-only transaction ledger with a materialized current balance. The balance consistency invariant is verified as total credits minus total debits.
        </p>
      </div>

      {/* Customer Selector Bar */}
      <Card className="p-4 border border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Select Customer Account:
          </label>
          <div className="flex-1 min-w-[280px]">
            {loadingUsers ? (
              <div className="text-sm text-slate-400">Loading customers...</div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  setActionSuccess("");
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
              >
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} — {u.email} ({u._id})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
          <span>✓ {actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess("")}
            className="text-xs font-bold underline uppercase ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadingWallet ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-slate-400 text-sm">Verifying ledger transaction hashes...</p>
        </div>
      ) : error ? (
        <Card className="p-6 text-center border-amber-200 bg-amber-50">
          <p className="text-amber-800 text-sm font-medium mb-1">{error}</p>
          <p className="text-xs text-amber-600">The customer will receive an initialized wallet automatically upon their first credit or deposit.</p>
        </Card>
      ) : walletData ? (
        <>
          {/* Wallet Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="p-5 border-l-4 border-l-emerald-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Current Available Balance
              </p>
              <p className="text-3xl font-extrabold font-heading text-slate-900 mt-2">
                {formatCurrency(walletData.wallet?.balance)}
              </p>
              <div className="mt-1 text-xs text-slate-400 font-mono">
                {walletData.wallet?.balance || 0} minor units (paise)
              </div>
            </Card>

            <Card className="p-5 border-l-4 border-l-blue-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Ledger Consistency Status
              </p>
              <div className="mt-2 flex items-center space-x-2">
                {walletData.balanceIntegrityVerified !== false ? (
                  <span className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center space-x-1">
                    <span>✓ Invariant Verified</span>
                  </span>
                ) : (
                  <span className="text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full flex items-center space-x-1">
                    <span>⚠️ Mismatch Detected</span>
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Sum(Credits) - Sum(Debits) == Balance
              </div>
            </Card>

            <Card className="p-5 border-l-4 border-l-purple-500 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Admin Balance Adjustments
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust stored funds with permanent audit log record.
                </p>
              </div>
              <div className="flex space-x-2 mt-4">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setActionType("CREDIT");
                    setAmountRupees("");
                    setReason("");
                    setActionError("");
                  }}
                >
                  + Credit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-rose-600 hover:text-rose-700"
                  onClick={() => {
                    setActionType("DEBIT");
                    setAmountRupees("");
                    setReason("");
                    setActionError("");
                  }}
                >
                  - Debit
                </Button>
              </div>
            </Card>
          </div>

          {/* Transactions Ledger Table */}
          <Card className="overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold font-heading text-slate-900">
                  Append-Only Transaction Ledger
                </h2>
                <p className="text-xs text-slate-500">
                  Customer: {selectedUserObj?.name || "Customer"} ({selectedUserObj?.email})
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {walletData.transactions?.length || 0} entries
              </span>
            </div>

            {walletData.transactions && walletData.transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-6">Timestamp</th>
                      <th className="py-3 px-6">Type</th>
                      <th className="py-3 px-6">Amount (₹)</th>
                      <th className="py-3 px-6">Amount (Paise)</th>
                      <th className="py-3 px-6">Description / Reason</th>
                      <th className="py-3 px-6">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {walletData.transactions.map((tx) => (
                      <tr key={tx._id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-6 font-mono text-xs text-slate-500">
                          {formatDate(tx.createdAt)}
                        </td>
                        <td className="py-3 px-6">
                          <Badge variant={tx.type === "CREDIT" ? "success" : "danger"}>
                            {tx.type}
                          </Badge>
                        </td>
                        <td
                          className={`py-3 px-6 font-semibold font-mono ${
                            tx.type === "CREDIT" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {tx.type === "CREDIT" ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 px-6 font-mono text-xs text-slate-400">
                          {tx.amount} paise
                        </td>
                        <td className="py-3 px-6 text-xs text-slate-700 max-w-xs truncate">
                          {tx.description || tx.reason || "Wallet transaction"}
                        </td>
                        <td className="py-3 px-6 font-mono text-xs text-slate-900 font-semibold">
                          {formatCurrency(tx.balanceAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No ledger transactions recorded yet for this wallet.
              </div>
            )}
          </Card>
        </>
      ) : null}

      {/* Credit / Debit Modal */}
      {actionType && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-md w-full my-auto p-6 shadow-2xl">
            <h3 className="text-lg font-bold font-heading text-slate-900 mb-1">
              Admin Wallet {actionType === "CREDIT" ? "Credit" : "Debit"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Target Customer: <span className="font-semibold text-slate-800">{selectedUserObj?.name}</span> ({selectedUserObj?.email})
            </p>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs mb-4">
                {actionError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Adjustment Amount (in Rupees ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    required
                    placeholder="100.00"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                {amountRupees && !isNaN(parseFloat(amountRupees)) && (
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    = {Math.round(parseFloat(amountRupees) * 100)} integer paise
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Mandatory Audit Reason (min 3 chars)
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder={
                    actionType === "CREDIT"
                      ? "e.g., Goodwill credit for delivery delay on ORD-1234"
                      : "e.g., Manual correction of promotional duplicate"
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                🔒 <span className="font-semibold text-slate-700">Strict Boundary Reminder:</span> Admin wallet adjustments modify internal customer stored balance ONLY. They do <strong>NOT</strong> disburse funds via external payment gateways (Razorpay).
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => setActionType(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={actionType === "CREDIT" ? "primary" : "danger"}
                  size="sm"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting
                    ? "Executing..."
                    : `Execute ${actionType === "CREDIT" ? "Credit" : "Debit"}`}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
