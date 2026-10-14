import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "aurora_recently_viewed";
const MAX_ITEMS = 8;

/**
 * Hook to manage recently viewed products in localStorage.
 */
export function useRecentlyViewed() {
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  // Load on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentlyViewed(parsed);
        }
      }
    } catch (e) {
      console.warn("Could not load recently viewed products from storage:", e);
    }
  }, []);

  // Add product to recently viewed
  const addRecentlyViewed = useCallback((product) => {
    if (!product || !product._id) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let list = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed;
        } catch {
          list = [];
        }
      }

      // Remove if already exists so we can move it to the front
      list = list.filter((item) => item._id !== product._id);

      // Add to front
      const simplified = {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        basePrice: product.basePrice,
        images: product.images || [],
        brand: product.brand || null,
        category: product.category || null,
        rating: product.rating || null,
        variants: product.variants || []
      };

      list.unshift(simplified);
      if (list.length > MAX_ITEMS) {
        list = list.slice(0, MAX_ITEMS);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      setRecentlyViewed(list);
    } catch (e) {
      console.warn("Could not save recently viewed product:", e);
    }
  }, []);

  const clearRecentlyViewed = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setRecentlyViewed([]);
    } catch (e) {
      console.warn("Could not clear recently viewed products:", e);
    }
  }, []);

  return {
    recentlyViewed,
    addRecentlyViewed,
    clearRecentlyViewed
  };
}
