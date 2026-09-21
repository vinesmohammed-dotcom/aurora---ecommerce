import React from "react";
import { Link } from "react-router-dom";
import PriceDisplay from "./PriceDisplay";
import { Package, ArrowRight } from "lucide-react";

export default function ProductCard({ product }) {
  if (!product) return null;

  const { name, slug, brand, category, images, basePrice, variants } = product;
  const mainImage = images && images.length > 0 ? images[0] : null;

  // Check if any active variant has stock
  const hasStock = variants && variants.some((v) => v.isActive && v.stock > 0);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
      {/* Product Image Box */}
      <Link to={`/products/${slug}`} className="relative aspect-square w-full overflow-hidden bg-slate-100">
        {mainImage ? (
          <img
            src={mainImage}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <Package className="h-12 w-12 stroke-[1.5]" />
          </div>
        )}

        {/* Stock Status Badge */}
        <div className="absolute top-3 right-3">
          {hasStock ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60 shadow-xs">
              In Stock
            </span>
          ) : (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200/60 shadow-xs">
              Out of Stock
            </span>
          )}
        </div>
      </Link>

      {/* Content Info */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-600">{brand?.name || "Brand"}</span>
          <span className="text-slate-400">•</span>
          <span>{category?.name || "Category"}</span>
        </div>

        <Link
          to={`/products/${slug}`}
          className="mt-2 line-clamp-2 text-base font-semibold text-slate-900 transition-colors hover:text-indigo-600"
          title={name}
        >
          {name}
        </Link>

        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Starting at</span>
            <PriceDisplay price={basePrice} className="text-lg font-bold text-slate-900" />
          </div>

          <Link
            to={`/products/${slug}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-indigo-600 hover:text-white"
          >
            <span>View</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
