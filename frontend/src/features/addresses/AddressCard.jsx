import React from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

export default function AddressCard({ address, onSetDefault, onEdit, onDelete, isSettingDefault = false, isDeleting = false }) {
  return (
    <div
      className={`relative rounded-xl border p-5 transition-all ${
        address.isDefault
          ? "border-indigo-500 bg-indigo-50/20 shadow-sm ring-1 ring-indigo-500/20"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={address.label === "HOME" ? "primary" : address.label === "WORK" ? "info" : "default"}>
            {address.label}
          </Badge>
          {address.isDefault && (
            <Badge variant="success">Default</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(address)}
            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            Edit
          </button>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={() => onDelete(address._id)}
            disabled={isDeleting}
            className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? "..." : "Delete"}
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <p className="font-bold text-slate-900">{address.fullName}</p>
        <p>{address.addressLine1}</p>
        {address.addressLine2 && <p className="text-slate-500">{address.addressLine2}</p>}
        <p>
          {address.city}, {address.state} - <span className="font-mono">{address.postalCode}</span>
        </p>
        <p className="text-xs text-slate-500">Phone: {address.phone}</p>
      </div>

      {!address.isDefault && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={() => onSetDefault(address._id)}
            disabled={isSettingDefault}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {isSettingDefault ? "Updating..." : "Set as Default"}
          </button>
        </div>
      )}
    </div>
  );
}
