import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import api from "../../services/api";
import { useScrollLock } from "../../hooks/useScrollLock";

export default function AdminUsersPage() {
  const { user: currentAdmin } = useSelector((state) => state.auth);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [blockedFilter, setBlockedFilter] = useState("");

  // Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [blockReason, setBlockReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState("");
  useScrollLock(!!selectedUser);

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      let query = `?page=${page}&limit=10`;
      if (search.trim()) query += `&search=${encodeURIComponent(search.trim())}`;
      if (roleFilter) query += `&role=${roleFilter}`;
      if (blockedFilter !== "") query += `&isBlocked=${blockedFilter}`;

      const res = await api.get(`/admin/users${query}`);
      if (res.success && res.data) {
        setUsers(res.data.users);
        setPagination(res.data.pagination);
      } else {
        setError(res.message || "Failed to load user accounts");
      }
    } catch (err) {
      setError(err.message || "Network error fetching users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, blockedFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleToggleBlock = async () => {
    if (!selectedUser) return;
    if (selectedUser.isBlocked === false && blockReason.trim().length < 5) {
      setActionError("A detailed reason of at least 5 characters is required to block an account.");
      return;
    }

    try {
      setSubmittingAction(true);
      setActionError("");
      const res = await api.patch(`/admin/users/${selectedUser._id}/block`, {
        isBlocked: !selectedUser.isBlocked,
        reason: blockReason.trim() || undefined
      });

      if (res.success) {
        // Refresh local state
        setUsers((prev) =>
          prev.map((u) => (u._id === selectedUser._id ? { ...u, isBlocked: !selectedUser.isBlocked } : u))
        );
        setSelectedUser(null);
        setBlockReason("");
      } else {
        setActionError(res.message || "Action failed");
      }
    } catch (err) {
      setActionError(err.message || "Failed to modify user access");
    } finally {
      setSubmittingAction(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">User Account Governance</h1>
        <p className="text-sm text-slate-500">
          Manage customer identity profiles, grant administrator roles, and enforce security suspensions with audit traceability.
        </p>
      </div>

      {/* Filters & Search Bar */}
      <Card className="p-4 border border-slate-200">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Search by customer name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">All Roles</option>
              <option value="CUSTOMER">Customers</option>
              <option value="ADMIN">Administrators</option>
            </select>
          </div>

          <div>
            <select
              value={blockedFilter}
              onChange={(e) => setBlockedFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">All Account Statuses</option>
              <option value="false">Active Only</option>
              <option value="true">Suspended Only</option>
            </select>
          </div>

          <Button type="submit" variant="secondary" size="md">
            Filter
          </Button>

          {(search || roleFilter || blockedFilter !== "") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRoleFilter("");
                setBlockedFilter("");
                fetchUsers(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Reset Filters
            </button>
          )}
        </form>
      </Card>

      {/* User Records Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-base font-bold font-heading text-slate-900">Registered Accounts</h2>
          <span className="text-xs text-slate-500 font-mono">
            {pagination.total} total account records
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-slate-400 text-sm">Querying user registry...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-600 text-sm">{error}</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No accounts found matching search filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Role</th>
                  <th className="py-3 px-6">Verification</th>
                  <th className="py-3 px-6">Account Status</th>
                  <th className="py-3 px-6">Registered</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = currentAdmin?._id === u._id;
                  return (
                    <tr key={u._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-6">
                        <div className="font-semibold text-slate-900 flex items-center space-x-2">
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 px-6">
                        <Badge variant={u.role === "ADMIN" ? "warning" : "info"}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-6">
                        {u.isEmailVerified ? (
                          <span className="inline-flex items-center text-xs text-emerald-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs text-amber-500 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-6">
                        {u.isBlocked ? (
                          <Badge variant="danger">Suspended</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="py-3 px-6 text-xs text-slate-500">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="py-3 px-6 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400 italic" title="Self-suspension is strictly prohibited">
                            Protected
                          </span>
                        ) : (
                          <Button
                            variant={u.isBlocked ? "secondary" : "danger"}
                            size="sm"
                            onClick={() => {
                              setSelectedUser(u);
                              setBlockReason("");
                              setActionError("");
                            }}
                          >
                            {u.isBlocked ? "Restore Access" : "Suspend User"}
                          </Button>
                        )}
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
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchUsers(pagination.page - 1)}
              >
                &larr; Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchUsers(pagination.page + 1)}
              >
                Next &rarr;
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Block / Unblock Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-md w-full my-auto p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold font-heading text-slate-900 mb-2">
              {selectedUser.isBlocked ? "Reactivate User Account" : "Suspend User Account"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Account: <span className="font-semibold text-slate-800">{selectedUser.name}</span> ({selectedUser.email})
            </p>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs mb-4">
                {actionError}
              </div>
            )}

            {!selectedUser.isBlocked && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Suspension (Required, min 5 chars)
                </label>
                <textarea
                  rows={3}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g., Chargeback fraud inquiry or policy violation..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
            )}

            <p className="text-[11px] text-slate-500 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {selectedUser.isBlocked
                ? "Reactivating this account immediately restores the customer's ability to log in, check out, and use their stored wallet balance."
                : "Suspended customers cannot log in, access cart, or checkout. All active tokens and sessions are immediately rejected at the security middleware."}
            </p>

            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={submittingAction}
                onClick={() => setSelectedUser(null)}
              >
                Cancel
              </Button>
              <Button
                variant={selectedUser.isBlocked ? "primary" : "danger"}
                size="sm"
                disabled={submittingAction}
                onClick={handleToggleBlock}
              >
                {submittingAction
                  ? "Processing..."
                  : selectedUser.isBlocked
                  ? "Confirm Reactivation"
                  : "Confirm Suspension"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
