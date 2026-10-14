import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import ProductFilters from "../components/catalog/ProductFilters";
import ProductSearch from "../components/catalog/ProductSearch";
import ProductSort from "../components/catalog/ProductSort";
import ProductGrid from "../components/catalog/ProductGrid";
import Pagination from "../components/catalog/Pagination";
import RecentlyViewedProducts from "../components/catalog/RecentlyViewedProducts";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { recentlyViewed, clearRecentlyViewed } = useRecentlyViewed();

  // URL state extractions
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "12", 10);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const brand = searchParams.get("brand") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const inStock = searchParams.get("inStock") || "";
  const sort = searchParams.get("sort") || "newest";

  // Data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [paginationMeta, setPaginationMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  useScrollLock(mobileFilterOpen);

  // Active filter helper derivations
  const hasActiveFilters = Boolean(search || category || brand || minPrice || maxPrice || inStock);
  const activeCategoryObj = categories.find((c) => c._id === category || c.slug === category);
  const activeCategoryName = activeCategoryObj ? activeCategoryObj.name : category;
  const activeBrandObj = brands.find((b) => b._id === brand || b.slug === brand);
  const activeBrandName = activeBrandObj ? activeBrandObj.name : brand;

  // Fetch Categories & Brands once on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          api.get("/categories"),
          api.get("/brands")
        ]);
        setCategories(catRes.data || []);
        setBrands(brandRes.data || []);
      } catch (err) {
        console.warn("[Shop Metadata Fetch Notice]", err.message);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch Products whenever searchParams change
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (page > 1) params.page = page;
      if (limit !== 12) params.limit = limit;
      if (search) params.search = search;
      if (category) params.category = category;
      if (brand) params.brand = brand;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (inStock) params.inStock = inStock;
      if (sort && sort !== "newest") params.sort = sort;

      const res = await api.get("/products", { params });
      setProducts(res.data || []);
      setPaginationMeta(res.meta || null);
    } catch (err) {
      setError(err.message || "Failed to load products.");
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, category, brand, minPrice, maxPrice, inStock, sort]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Update query params helper
  const updateQuery = (updates) => {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === null || val === "") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, val);
      }
    });
    // Reset to page 1 when changing filters
    if (!updates.page) {
      nextParams.delete("page");
    }
    setSearchParams(nextParams);
  };

  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Explore Catalog</h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse verified products, styles, and live stock across all categories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ProductSearch initialValue={search} onSearch={(query) => updateQuery({ search: query })} />
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Desktop Sidebar Filters */}
        <div className="hidden lg:block lg:col-span-1">
          <ProductFilters
            categories={categories}
            brands={brands}
            selectedCategory={category}
            selectedBrand={brand}
            minPrice={minPrice}
            maxPrice={maxPrice}
            inStock={inStock}
            onFilterChange={(newFilters) => updateQuery(newFilters)}
            onReset={handleResetFilters}
          />
        </div>

        {/* Product Listing Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Subheader: Item Count & Sort Bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {products.length} {products.length === 1 ? "product" : "products"}
              </span>
              {paginationMeta && paginationMeta.total > 0 && ` of ${paginationMeta.total}`}
            </p>

            <ProductSort currentSort={sort} onSortChange={(newSort) => updateQuery({ sort: newSort })} />
          </div>

          {/* Active Filter Chips & Clear All */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-100/70 p-3 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 mr-1">Active Filters:</span>

              {search && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-300 px-3 py-1 text-xs text-slate-800 shadow-2xs">
                  <span>Search: "{search}"</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ search: "" })}
                    className="rounded-full p-0.5 hover:bg-slate-200 text-slate-400 hover:text-slate-800"
                    title="Remove search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {category && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-800 shadow-2xs">
                  <span>Category: {activeCategoryName}</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ category: "" })}
                    className="rounded-full p-0.5 hover:bg-indigo-100 text-indigo-500 hover:text-indigo-800"
                    title="Remove category filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {brand && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-800 shadow-2xs">
                  <span>Brand: {activeBrandName}</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ brand: "" })}
                    className="rounded-full p-0.5 hover:bg-indigo-100 text-indigo-500 hover:text-indigo-800"
                    title="Remove brand filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {(minPrice || maxPrice) && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-300 px-3 py-1 text-xs text-slate-800 shadow-2xs">
                  <span>Price: ₹{minPrice || 0} – ₹{maxPrice || "Max"}</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ minPrice: "", maxPrice: "" })}
                    className="rounded-full p-0.5 hover:bg-slate-200 text-slate-400 hover:text-slate-800"
                    title="Remove price filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {inStock && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-800 shadow-2xs">
                  <span>In Stock Only</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ inStock: "" })}
                    className="rounded-full p-0.5 hover:bg-emerald-100 text-emerald-500 hover:text-emerald-800"
                    title="Remove in-stock filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleResetFilters}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear All</span>
              </button>
            </div>
          )}

          {/* Products Grid */}
          <ProductGrid
            products={products}
            isLoading={isLoading}
            error={error}
            onResetFilters={handleResetFilters}
          />

          {/* Pagination */}
          {paginationMeta && paginationMeta.totalPages > 1 && (
            <Pagination
              currentPage={paginationMeta.page}
              totalPages={paginationMeta.totalPages}
              onPageChange={(nextPage) => updateQuery({ page: nextPage })}
            />
          )}
        </div>
      </div>

      {/* Persistent Recently Viewed Shelf */}
      <RecentlyViewedProducts items={recentlyViewed} onClear={clearRecentlyViewed} />

      {/* Mobile Filters Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileFilterOpen(false)} />
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col bg-white p-6 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Filters</h3>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4">
              <ProductFilters
                categories={categories}
                brands={brands}
                selectedCategory={category}
                selectedBrand={brand}
                minPrice={minPrice}
                maxPrice={maxPrice}
                inStock={inStock}
                onFilterChange={(newFilters) => {
                  updateQuery(newFilters);
                  setMobileFilterOpen(false);
                }}
                onReset={() => {
                  handleResetFilters();
                  setMobileFilterOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
