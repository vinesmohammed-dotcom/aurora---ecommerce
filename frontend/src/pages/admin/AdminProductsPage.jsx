import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import PriceDisplay from "../../components/catalog/PriceDisplay";

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

  // Create/Edit Product Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    title: "",
    description: "",
    category: "",
    brand: "",
    images: "",
    tags: "",
    isActive: true,
    // For new product creation: initial variant
    initialSku: "",
    initialVariantTitle: "Default",
    initialPrice: "",
    initialCostPrice: "",
    initialStock: "10"
  });

  // Variant Management Modal
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [activeProductForVariants, setActiveProductForVariants] = useState(null);
  const [variantForm, setVariantForm] = useState({
    sku: "",
    title: "",
    price: "",
    costPrice: "",
    stock: "0",
    isActive: true,
    color: "",
    size: ""
  });
  const [editingVariantId, setEditingVariantId] = useState(null);

  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load lookup data: categories & brands
  useEffect(() => {
    async function loadLookups() {
      try {
        const [catRes, brandRes] = await Promise.all([
          api.get("/categories?limit=100"),
          api.get("/brands?limit=100")
        ]);
        if (catRes.success) setCategories(catRes.data.categories || []);
        if (brandRes.success) setBrands(brandRes.data.brands || []);
      } catch (err) {
        console.error("Failed to load categories/brands for product form:", err);
      }
    }
    loadLookups();
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10"
      });
      if (search.trim()) params.set("search", search.trim());
      if (categoryFilter) params.set("category", categoryFilter);
      if (brandFilter) params.set("brand", brandFilter);

      const res = await api.get(`/products/admin/all?${params.toString()}`);
      if (res.success) {
        setProducts(res.data.products || []);
        setPagination(res.data.pagination || { total: 0, pages: 1, limit: 10 });
      }
    } catch (err) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, brandFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      title: "",
      description: "",
      category: categories[0]?._id || "",
      brand: brands[0]?._id || "",
      images: "https://placehold.co/600x600/png?text=Product+Image",
      tags: "",
      isActive: true,
      initialSku: `SKU-${Date.now().toString().slice(-6)}`,
      initialVariantTitle: "Standard",
      initialPrice: "999",
      initialCostPrice: "500",
      initialStock: "25"
    });
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product) => {
    setEditingProduct(product);
    setProductForm({
      title: product.title || "",
      description: product.description || "",
      category: product.category?._id || product.category || "",
      brand: product.brand?._id || product.brand || "",
      images: Array.isArray(product.images) ? product.images.join(", ") : "",
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
      isActive: product.isActive !== undefined ? product.isActive : true
    });
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const handleProductFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const imagesArray = productForm.images
        .split(",")
        .map((img) => img.trim())
        .filter(Boolean);
      const tagsArray = productForm.tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      if (editingProduct) {
        // Update product metadata
        const payload = {
          name: productForm.title,
          title: productForm.title,
          description: productForm.description,
          category: productForm.category,
          brand: productForm.brand,
          images: imagesArray,
          tags: tagsArray,
          isActive: productForm.isActive
        };
        const res = await api.put(`/products/${editingProduct._id}`, payload);
        if (res.success) {
          setIsProductModalOpen(false);
          fetchProducts();
        }
      } else {
        // Create new product with required initial variant
        const payload = {
          name: productForm.title,
          title: productForm.title,
          description: productForm.description,
          category: productForm.category,
          brand: productForm.brand,
          images: imagesArray,
          tags: tagsArray,
          isActive: productForm.isActive,
          variants: [
            {
              sku: productForm.initialSku.trim().toUpperCase(),
              title: productForm.initialVariantTitle,
              price: Number(productForm.initialPrice),
              costPrice: Number(productForm.initialCostPrice),
              stock: Number(productForm.initialStock),
              isActive: true
            }
          ]
        };
        const res = await api.post("/products", payload);
        if (res.success) {
          setIsProductModalOpen(false);
          fetchProducts();
        }
      }
    } catch (err) {
      setFormError(err.message || "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Delete product "${product.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/products/${product._id}`);
      fetchProducts();
    } catch (err) {
      alert("Failed to delete product: " + (err.message || "Unknown error"));
    }
  };

  const handleToggleProductStatus = async (product) => {
    try {
      await api.put(`/products/${product._id}`, { isActive: !product.isActive });
      fetchProducts();
    } catch (err) {
      alert("Failed to toggle status: " + (err.message || "Unknown error"));
    }
  };

  // Variant Modal Handlers
  const openVariantManager = (product) => {
    setActiveProductForVariants(product);
    setEditingVariantId(null);
    setVariantForm({
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      title: "",
      price: "",
      costPrice: "",
      stock: "10",
      isActive: true,
      color: "",
      size: ""
    });
    setFormError(null);
    setIsVariantModalOpen(true);
  };

  const handleEditVariantClick = (variant) => {
    setEditingVariantId(variant._id);
    setVariantForm({
      sku: variant.sku,
      title: variant.title,
      price: variant.price.toString(),
      costPrice: variant.costPrice !== undefined ? variant.costPrice.toString() : "",
      stock: variant.stock.toString(),
      isActive: variant.isActive !== undefined ? variant.isActive : true,
      color: variant.attributes?.get ? variant.attributes.get("color") || "" : (variant.attributes?.color || ""),
      size: variant.attributes?.get ? variant.attributes.get("size") || "" : (variant.attributes?.size || "")
    });
  };

  const handleVariantFormSubmit = async (e) => {
    e.preventDefault();
    if (!activeProductForVariants) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const attributes = {};
      if (variantForm.color.trim()) attributes.color = variantForm.color.trim();
      if (variantForm.size.trim()) attributes.size = variantForm.size.trim();

      const payload = {
        sku: variantForm.sku.trim().toUpperCase(),
        title: variantForm.title,
        price: Number(variantForm.price),
        costPrice: Number(variantForm.costPrice),
        stock: Number(variantForm.stock),
        isActive: variantForm.isActive,
        attributes
      };

      let updatedProduct;
      if (editingVariantId) {
        // Update variant
        const res = await api.put(
          `/products/${activeProductForVariants._id}/variants/${editingVariantId}`,
          payload
        );
        updatedProduct = res.data.product;
      } else {
        // Add variant
        const res = await api.post(
          `/products/${activeProductForVariants._id}/variants`,
          payload
        );
        updatedProduct = res.data.product;
      }

      // Update state
      setActiveProductForVariants(updatedProduct);
      setEditingVariantId(null);
      setVariantForm({
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        title: "",
        price: "",
        costPrice: "",
        stock: "10",
        isActive: true,
        color: "",
        size: ""
      });
      fetchProducts();
    } catch (err) {
      setFormError(err.message || "Failed to save variant");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVariant = async (variantId) => {
    if (!activeProductForVariants) return;
    if (activeProductForVariants.variants.length <= 1) {
      alert("A product must maintain at least one variant. Cannot delete the only variant.");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this variant?")) return;

    try {
      const res = await api.delete(
        `/products/${activeProductForVariants._id}/variants/${variantId}`
      );
      if (res.success) {
        setActiveProductForVariants(res.data.product);
        fetchProducts();
      }
    } catch (err) {
      alert("Failed to delete variant: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            <Link to="/admin" className="hover:text-primary-600 transition-colors">Admin</Link>
            <span>/</span>
            <span className="text-slate-700">Products</span>
          </div>
          <h1 className="text-2xl font-bold font-heading text-slate-900">Product & Variant Catalog</h1>
          <p className="text-sm text-slate-500">Manage products, embedded variants, SKU inventory, and margin metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="secondary" size="sm">Back to Dashboard</Button>
          </Link>
          <Button variant="primary" size="sm" onClick={openCreateProductModal}>
            + Create Product
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleFilterSubmit} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by product name, SKU, or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="sm">Filter</Button>
          {(search || categoryFilter || brandFilter) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setCategoryFilter("");
                setBrandFilter("");
                setPage(1);
              }}
            >
              Reset
            </Button>
          )}
        </form>
      </Card>

      {/* Table Section */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading catalog...</div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 bg-rose-50 border border-rose-200 m-4 rounded-lg">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-base font-medium text-slate-700">No products found</p>
            <p className="text-sm mt-1">Add items with variants to populate your store catalog.</p>
            <Button variant="primary" size="sm" className="mt-4" onClick={openCreateProductModal}>
              Create Product
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5">Category / Brand</th>
                  <th className="px-6 py-3.5">Base Price</th>
                  <th className="px-6 py-3.5">Variants & Stock</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((p) => {
                  const totalStock = p.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
                  const activeVariantsCount = p.variants?.filter((v) => v.isActive).length || 0;
                  const mainImage = p.images?.[0] || "https://placehold.co/100x100?text=No+Img";

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={mainImage}
                            alt={p.title}
                            className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-200"
                            onError={(e) => { e.target.src = "https://placehold.co/100x100?text=Error"; }}
                          />
                          <div>
                            <div className="font-semibold text-slate-900">{p.title}</div>
                            <div className="text-xs font-mono text-slate-400">/{p.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-slate-900">{p.category?.name || "Uncategorized"}</div>
                        <div className="text-xs text-slate-400">{p.brand?.name || "No Brand"}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        <PriceDisplay price={p.basePrice} size="sm" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            {p.variants?.length || 0} variants
                          </span>
                          <span className="text-xs text-slate-400">
                            ({activeVariantsCount} active)
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Total Stock: <span className="font-medium text-slate-900">{totalStock}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleProductStatus(p)}
                          title="Click to toggle status"
                          className="cursor-pointer focus:outline-none"
                        >
                          {p.isActive ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="neutral">Draft</Badge>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openVariantManager(p)}
                          className="text-primary-600 hover:text-primary-800 text-xs font-semibold px-2 py-1 rounded hover:bg-primary-50 transition"
                        >
                          Variants ({p.variants?.length || 0})
                        </button>
                        <button
                          onClick={() => openEditProductModal(p)}
                          className="text-slate-600 hover:text-slate-800 text-xs font-semibold px-2 py-1 rounded hover:bg-slate-100 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-2 py-1 rounded hover:bg-rose-50 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {products.length} of {pagination.total} entries
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <span className="px-3 py-1 font-semibold text-slate-700 bg-slate-100 rounded">
                {page} / {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => Math.min(p + 1, pagination.pages))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal 1: Create / Edit Product Metadata */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <h3 className="text-lg font-bold font-heading text-slate-900">
                {editingProduct ? "Edit Product Details" : "Create New Product"}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleProductFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Performance Running Shoe"
                  value={productForm.title}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={productForm.brand}
                    onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  >
                    <option value="">Select Brand</option>
                    {brands.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Comprehensive technical specifications and product description..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Image URLs (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/img1.jpg, https://example.com/img2.jpg"
                  value={productForm.images}
                  onChange={(e) => setProductForm({ ...productForm, images: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tags (comma-separated keywords)
                </label>
                <input
                  type="text"
                  placeholder="running, lightweight, cushion, marathon"
                  value={productForm.tags}
                  onChange={(e) => setProductForm({ ...productForm, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Initial Variant section only for New Product */}
              {!editingProduct && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
                    Initial Product Variant (Required)
                  </div>
                  <p className="text-xs text-slate-500">
                    Every product must have at least one active variant with unique SKU, price, cost price, and stock.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">SKU *</label>
                      <input
                        type="text"
                        required
                        value={productForm.initialSku}
                        onChange={(e) => setProductForm({ ...productForm, initialSku: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500 uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Variant Name *</label>
                      <input
                        type="text"
                        required
                        value={productForm.initialVariantTitle}
                        onChange={(e) => setProductForm({ ...productForm, initialVariantTitle: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Retail Price (₹) *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={productForm.initialPrice}
                        onChange={(e) => setProductForm({ ...productForm, initialPrice: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Cost Price (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={productForm.initialCostPrice}
                        onChange={(e) => setProductForm({ ...productForm, initialCostPrice: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Stock Quantity *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={productForm.initialStock}
                        onChange={(e) => setProductForm({ ...productForm, initialStock: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="productIsActive"
                  checked={productForm.isActive}
                  onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="productIsActive" className="text-xs font-semibold text-slate-700 select-none">
                  Active (published to public storefront)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsProductModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Embedded Variants Manager */}
      {isVariantModalOpen && activeProductForVariants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 space-y-6 my-8">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h3 className="text-lg font-bold font-heading text-slate-900">
                  Manage Variants: {activeProductForVariants.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Directly manages embedded subdocuments with real-time basePrice recalculation.
                </p>
              </div>
              <button
                onClick={() => setIsVariantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* List existing variants */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5">Title / Options</th>
                    <th className="px-4 py-2.5">Price</th>
                    <th className="px-4 py-2.5">Cost Price</th>
                    <th className="px-4 py-2.5">Stock</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeProductForVariants.variants?.map((v) => {
                    const attrs = v.attributes instanceof Map ? Object.fromEntries(v.attributes) : (v.attributes || {});
                    const attrSummary = Object.entries(attrs).map(([k, val]) => `${k}: ${val}`).join(", ");

                    return (
                      <tr key={v._id} className={editingVariantId === v._id ? "bg-primary-50/50" : "hover:bg-slate-50/50"}>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{v.sku}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{v.title}</div>
                          {attrSummary && <div className="text-slate-400 text-[10px]">{attrSummary}</div>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">₹{v.price}</td>
                        <td className="px-4 py-3 text-slate-500">₹{v.costPrice !== undefined ? v.costPrice : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${v.stock > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {v.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {v.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Off</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => handleEditVariantClick(v)}
                            className="text-primary-600 hover:text-primary-800 font-semibold text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteVariant(v._id)}
                            className="text-rose-600 hover:text-rose-800 font-semibold text-xs"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add / Edit Variant Form */}
            <form onSubmit={handleVariantFormSubmit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {editingVariantId ? "Edit Selected Variant" : "+ Add New Variant Subdocument"}
                </h4>
                {editingVariantId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVariantId(null);
                      setVariantForm({
                        sku: `SKU-${Date.now().toString().slice(-6)}`,
                        title: "",
                        price: "",
                        costPrice: "",
                        stock: "10",
                        isActive: true,
                        color: "",
                        size: ""
                      });
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Cancel Edit Mode
                  </button>
                )}
              </div>

              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={variantForm.sku}
                    onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs uppercase font-mono focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Size 10 / Red"
                    value={variantForm.title}
                    onChange={(e) => setVariantForm({ ...variantForm, title: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={variantForm.price}
                    onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cost Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={variantForm.costPrice}
                    onChange={(e) => setVariantForm({ ...variantForm, costPrice: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={variantForm.stock}
                    onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Color (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Midnight Blue"
                    value={variantForm.color}
                    onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Size (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. US 10.5"
                    value={variantForm.size}
                    onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="variantIsActive"
                    checked={variantForm.isActive}
                    onChange={(e) => setVariantForm({ ...variantForm, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="variantIsActive" className="text-xs font-semibold text-slate-700 select-none">
                    Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? "Saving..." : editingVariantId ? "Update Variant" : "Save Variant"}
                </Button>
              </div>
            </form>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsVariantModalOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
