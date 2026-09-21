import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import api from "../services/api";
import { setCartItemCount } from "../store/slices/cartSlice";
import CartItem from "../features/cart/CartItem";
import CartSummary from "../features/cart/CartSummary";
import Button from "../components/ui/Button";

export default function CartPage() {
  const dispatch = useDispatch();
  const [cart, setCart] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingVariantId, setUpdatingVariantId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const fetchCart = async () => {
    try {
      setIsLoading(true);
      setError("");
      const res = await api.get("/cart");
      if (res.success && res.data?.cart) {
        setCart(res.data.cart);
        dispatch(setCartItemCount(res.data.cart.totalItems || 0));
      }
    } catch (err) {
      setError(err.message || "Failed to load shopping cart.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const handleUpdateQuantity = async (variantId, newQty) => {
    if (newQty < 1 || newQty > 10) return;
    try {
      setUpdatingVariantId(variantId);
      const res = await api.patch(`/cart/items/${variantId}`, { quantity: newQty });
      if (res.success && res.data?.cart) {
        setCart(res.data.cart);
        dispatch(setCartItemCount(res.data.cart.totalItems || 0));
      }
    } catch (err) {
      alert(err.message || "Could not update quantity.");
    } finally {
      setUpdatingVariantId(null);
    }
  };

  const handleRemoveItem = async (variantId) => {
    try {
      setUpdatingVariantId(variantId);
      const res = await api.delete(`/cart/items/${variantId}`);
      if (res.success && res.data?.cart) {
        setCart(res.data.cart);
        dispatch(setCartItemCount(res.data.cart.totalItems || 0));
      }
    } catch (err) {
      alert(err.message || "Could not remove item from cart.");
    } finally {
      setUpdatingVariantId(null);
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm("Are you sure you want to clear your cart?")) return;
    try {
      setIsClearing(true);
      const res = await api.delete("/cart");
      if (res.success && res.data?.cart) {
        setCart(res.data.cart);
        dispatch(setCartItemCount(0));
      }
    } catch (err) {
      alert(err.message || "Could not clear cart.");
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading && !cart) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-8 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <div className="h-28 bg-slate-100 rounded-xl" />
            <div className="h-28 bg-slate-100 rounded-xl" />
          </div>
          <div className="h-56 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const items = cart?.items || [];
  const totalItems = cart?.totalItems || 0;
  const subtotal = cart?.subtotal || 0;
  const hasStaleItems = cart?.hasStaleItems || false;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold font-heading text-slate-900">Your Shopping Cart</h1>
        <p className="text-sm text-slate-500">
          {totalItems === 0
            ? "Your cart is currently empty"
            : `You have ${totalItems} item${totalItems === 1 ? "" : "s"} in your cart`}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-2xl font-bold">
            🛒
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-heading">Your Cart is Empty</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Explore our curated catalog to find premium products and add them to your cart.
          </p>
          <div className="pt-2">
            <Link to="/shop">
              <Button variant="primary">Browse Catalog</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            {items.map((item) => (
              <CartItem
                key={`${item.productId}-${item.variantId}`}
                item={item}
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={handleRemoveItem}
                isUpdating={updatingVariantId === item.variantId}
              />
            ))}
          </div>

          <div className="md:col-span-1">
            <CartSummary
              subtotal={subtotal}
              totalItems={totalItems}
              hasStaleItems={hasStaleItems}
              onClearCart={handleClearCart}
              isClearing={isClearing}
            />
          </div>
        </div>
      )}
    </div>
  );
}
