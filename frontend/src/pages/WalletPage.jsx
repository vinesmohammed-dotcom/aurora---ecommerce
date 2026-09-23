import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(val || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const fetchWalletData = async (page = 1) => {
    try {
      setIsLoading(true);
      setError("");

      const [walletRes, txRes] = await Promise.all([
        api.get("/wallet"),
        api.get(`/wallet/transactions?page=${page}&limit=10`)
      ]);

      if (walletRes.success && walletRes.data) {
        setWallet(walletRes.data.wallet);
      }

      if (txRes.success && txRes.data) {
        setTransactions(txRes.data.transactions || []);
        setPagination(txRes.data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
      }
    } catch (err) {
      setError(err.message || "Failed to load wallet information.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData(1);
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchWalletData(newPage);
    }
  };

  return (
    <div className="mx-auto max-w-5xl py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-slate-900">Customer Wallet</h1>
          <p className="text-sm text-slate-500">
            View your store credit balance and append-only transaction ledger.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/shop">
            <Button variant="secondary" size="sm">
              Shop Now
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchWalletData(pagination.page)}
            disabled={isLoading}
          >
            ↻ Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* Wallet Balance Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-2xl border border-indigo-500/20">
        <div className="absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl font-mono select-none">
          ₹
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wider uppercase text-indigo-300">
                Active Store Credit Wallet
              </span>
            </div>
            <Badge variant="neutral" className="bg-white/10 text-white border-white/20">
              {wallet?.currency || "INR"}
            </Badge>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">CURRENT BALANCE</span>
            <div className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight text-white">
              {isLoading && !wallet ? (
                <div className="h-12 w-48 bg-white/20 rounded-xl animate-pulse" />
              ) : (
                formatCurrency((wallet?.balance || 0) / 100)
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              <span>Security Guarantee: </span>
              <span className="text-slate-200 font-medium">
                Immutable, ACID-compliant ledger tracking
              </span>
            </div>
            <div>
              <span>Account Status: </span>
              <span className="text-emerald-400 font-semibold">Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Separation Notice */}
      <Card className="p-4 bg-amber-50/70 border-amber-200 text-amber-900 text-xs rounded-2xl flex items-start gap-3">
        <span className="text-xl leading-none">💡</span>
        <div>
          <strong className="font-semibold block mb-0.5">Refund Policy Notice</strong>
          <span>
            Online payment refunds (Razorpay UPI, Debit/Credit Card, Netbanking) are processed
            directly back to your original payment method. The Wallet balance holds internal store
            credits, goodwill compensations, and promotional bonuses.
          </span>
        </div>
      </Card>

      {/* Append-Only Transaction Ledger */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-2xl">
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 font-heading">
              Transaction History
            </h2>
            <p className="text-xs text-slate-500">
              Complete audit log of all balance credits and debits.
            </p>
          </div>
          <Badge variant="neutral">
            {pagination.total} {pagination.total === 1 ? "Record" : "Records"}
          </Badge>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
              📝
            </div>
            <h3 className="text-base font-bold text-slate-800">No Transactions Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Any promotional rewards, goodwill adjustments, or wallet operations will appear here as
              immutable ledger records.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 uppercase text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Date & Time</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Reference / Description</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const isCredit = tx.type === "CREDIT";

                  return (
                    <tr key={tx._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={isCredit ? "success" : "danger"}>
                          {isCredit ? "+ CREDIT" : "- DEBIT"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{tx.description}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Ref: {tx.referenceType} ({tx.referenceId})
                        </div>
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-mono font-bold whitespace-nowrap ${
                          isCredit ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {formatCurrency((tx.amount || 0) / 100)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency((tx.balanceAfter || 0) / 100)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="bg-slate-50/80 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
