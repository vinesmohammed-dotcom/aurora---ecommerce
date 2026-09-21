import React, { useState, useEffect } from "react";
import api from "../../services/api";
import AddressCard from "./AddressCard";
import AddressForm from "./AddressForm";
import Button from "../../components/ui/Button";

export default function AddressList() {
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchAddresses = async () => {
    try {
      setIsLoading(true);
      setError("");
      const res = await api.get("/addresses");
      if (res.success && res.data?.addresses) {
        setAddresses(res.data.addresses);
      }
    } catch (err) {
      setError(err.message || "Failed to load addresses.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleCreateOrUpdate = async (formData) => {
    try {
      setIsLoading(true);
      if (editingAddress) {
        await api.put(`/addresses/${editingAddress._id}`, formData);
      } else {
        await api.post("/addresses", formData);
      }
      setShowForm(false);
      setEditingAddress(null);
      await fetchAddresses();
    } catch (err) {
      alert(err.message || "Failed to save address.");
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      setActionLoadingId(addressId);
      await api.patch(`/addresses/${addressId}/default`);
      await fetchAddresses();
    } catch (err) {
      alert(err.message || "Failed to update default address.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (addressId) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;

    try {
      setActionLoadingId(addressId);
      await api.delete(`/addresses/${addressId}`);
      await fetchAddresses();
    } catch (err) {
      alert(err.message || "Failed to delete address.");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading && addresses.length === 0) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-36 bg-slate-100 rounded-xl" />
          <div className="h-36 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-heading text-slate-900">Saved Addresses</h2>
          <p className="text-xs text-slate-500">Manage your delivery destinations and default address.</p>
        </div>
        {!showForm && (
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setEditingAddress(null);
              setShowForm(true);
            }}
          >
            + Add New Address
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {showForm && (
        <AddressForm
          initialData={editingAddress}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingAddress(null);
          }}
          isLoading={isLoading}
        />
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">No saved addresses found.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Add your first delivery address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address._id}
              address={address}
              onSetDefault={handleSetDefault}
              onEdit={(addr) => {
                setEditingAddress(addr);
                setShowForm(true);
              }}
              onDelete={handleDelete}
              isSettingDefault={actionLoadingId === address._id}
              isDeleting={actionLoadingId === address._id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
