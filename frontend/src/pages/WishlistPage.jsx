import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import api from "../services/api";
import { setCartItemCount } from "../store/slices/cartSlice";
import WishlistItem from "../features/wishlist/WishlistItem";
import Button from "../components/ui/Button";

export default function WishlistPage() {
  const dispatch = useDispatch();
  const [wishlist, setWishlist] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionProductId, setActionProductId] = useState(null);

  const fetchWishlist = async () => {
    try {
      setIsLoading(true);
      setError("");
      const res = await api.get("/wishlist");
      if (res.success && res.data?.wishlist) {
        setWishlist(res.data.wishlist);
      }
    } catch (err) {
      setError(err.message || "Failed to load wishlist.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const handleRemove = async (productId) => {
    try {
      setActionProductId(productId);
      const res = await api.delete(`/wishlist/items/${productId}`);
      if (res.success && res.data?.wishlist) {
        setWishlist(res.data.wishlist);
      }
    } catch (err) {
      alert(err.message || "Failed to remove item from wishlist.");
    } finally {
      setActionProductId(null);
    }
  };

  const handleMoveToCart = async (product) => {
    const availableVariant = product.variants?.find((v) => v.isActive && v.stock > 0);
    if (!availableVariant) {
      alert("No available variants in stock to add to cart.");
      return;
    }

    try {
      setActionProductId(product._id);
      // 1. Add to cart
      const cartRes = await api.post("/cart/items", {
        productId: product._id,
        variantId: availableVariant._id,
        quantity: 1
      });
      if (cartRes.success && cartRes.data?.cart) {
        dispatch(setCartItemCount(cartRes.data.cart.totalItems || 0));
      }

      // 2. Remove from wishlist
      const wishRes = await api.delete(`/wishlist/items/${product._id}`);
      if (wishRes.success && wishRes.data?.wishlist) {
        setWishlist(wishRes.data.wishlist);
      }
    } catch (err) {
      alert(err.message || "Failed to move item to cart.");
    } finally {
      setActionProductId(null);
    }
  };

  if (isLoading && !wishlist) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-8 animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded" />
        <div className="space-y-3">
          <div className="h-24 bg-slate-100 rounded-xl" />
          <div className="h-24 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const items = wishlist?.items || [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold font-heading text-slate-900">My Wishlist</h1>
        <p className="text-sm text-slate-500">
          {items.length === 0
            ? "Your wishlist is empty"
            : `You have saved ${items.length} product${items.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 text-2xl font-bold">
            ❤️
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-heading">Your Wishlist is Empty</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Save items you like to track availability and quickly move them to your cart.
          </p>
          <div className="pt-2">
            <Link to="/shop">
              <Button variant="primary">Discover Products</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((product) => (
            <WishlistItem
              key={product._id}
              product={product}
              onMoveToCart={handleMoveToCart}
              onRemove={handleRemove}
              isMoving={actionProductId === product._id}
              isRemoving={actionProductId === product._id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
