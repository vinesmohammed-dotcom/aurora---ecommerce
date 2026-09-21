import React from "react";

/**
 * Standard formatted currency display for Indian Rupee (INR)
 */
export default function PriceDisplay({ price, className = "text-lg font-bold text-slate-900" }) {
  if (price === undefined || price === null) return null;

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(price);

  return <span className={className}>{formatted}</span>;
}
