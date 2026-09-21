import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import ProductFilters from "../components/catalog/ProductFilters";
import ProductSearch from "../components/catalog/ProductSearch";
import ProductSort from "../components/catalog/ProductSort";
import ProductGrid from "../components/catalog/ProductGrid";
import Pagination from "../components/catalog/Pagination";
import { SlidersHorizontal, X } from "lucide-react";

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();

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
