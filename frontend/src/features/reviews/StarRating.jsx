import React, { useState } from "react";
import { Star } from "lucide-react";

/**
 * StarRating component
 * Supports read-only display or interactive rating selection (1 to 5 stars).
 *
 * @param {number} rating - Current rating value (0 to 5)
 * @param {boolean} readOnly - Whether rating is non-interactive
 * @param {function} onChange - Callback when rating changes: (newRating) => void
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} className - Additional classes for wrapper
 */
export default function StarRating({
  rating = 0,
  readOnly = true,
  onChange = null,
  size = "md",
  className = ""
}) {
  const [hoverRating, setHoverRating] = useState(0);

  const starSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-5 w-5",
    lg: "h-7 w-7"
  };

  const starSizeClass = starSizes[size] || starSizes.md;
  const currentRating = hoverRating || rating;

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role={readOnly ? "img" : "radiogroup"}
      aria-label={`Rating: ${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((starValue) => {
        const isFilled = starValue <= currentRating;
        const isHalf = !readOnly && starValue === Math.ceil(currentRating) && currentRating % 1 !== 0;

        if (readOnly) {
          return (
            <Star
              key={starValue}
              className={`${starSizeClass} ${
                isFilled
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-200 fill-slate-100"
              }`}
            />
          );
        }

        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={starValue === rating}
            aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
            className="cursor-pointer transition-transform hover:scale-115 focus:outline-none"
            onClick={() => onChange && onChange(starValue)}
            onMouseEnter={() => setHoverRating(starValue)}
            onMouseLeave={() => setHoverRating(0)}
          >
            <Star
              className={`${starSizeClass} transition-colors ${
                isFilled
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-300 fill-transparent hover:text-amber-300"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
