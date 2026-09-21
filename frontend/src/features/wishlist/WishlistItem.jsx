import React from "react";
import { Link } from "react-router-dom";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

export default function WishlistItem({ product, onMoveToCart, onRemove, isMoving = false, isRemoving = false }) {
  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

  const lowestPrice =
    product.variants?.length > 0
      ? Math.min(...product.variants.filter((v) => v.isActive).map((v) => v.price))
      : 0;

  const inStock = product.variants?.some((v) => v.isActive && v.stock > 0);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300">
      <div className="flex items-center gap-4">
        <Link to={`/product/${product.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
          {product.images && product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
              No Image
            </div>
          )}
        </Link>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
              {product.category?.name || "Catalog"}
            </span>
            <Badge variant={inStock ? "success" : "default"}>
              {inStock ? "In Stock" : "Out of Stock"}
            </Badge>
          </div>

          <Link to={`/product/${product.slug}`} className="block">
            <h4 className="font-heading text-base font-bold text-slate-900 hover:text-indigo-600 transition-colors">
              {product.name}
            </h4>
          </Link>

          <p className="font-mono text-sm font-bold text-slate-900">
            {formatCurrency(lowestPrice)}
          </p>
        </div>
      </div>

      <div className="flex w-full sm:w-auto items-center justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <button
          type="button"
          onClick={() => onRemove(product._id)}
          disabled={isRemoving}
          className="text-xs font-semibold text-rose-500 hover:text-rose-700 disabled:opacity-40 transition-colors"
        >
          {isRemoving ? "Removing..." : "Remove"}
        </button>

        <Button
          type="button"
          variant="primary"
          disabled={!inStock || isMoving}
          onClick={() => onMoveToCart(product)}
        >
          {isMoving ? "Moving..." : "Move to Cart"}
        </Button>
      </div>
    </div>
  );
}
