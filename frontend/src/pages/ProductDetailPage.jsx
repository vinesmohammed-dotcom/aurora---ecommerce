import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import api from "../services/api";
import { setCartItemCount } from "../store/slices/cartSlice";
import VariantSelector from "../components/catalog/VariantSelector";
import { Package, ShoppingBag, ArrowLeft, ShieldCheck, Truck, RotateCcw, Heart } from "lucide-react";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartNotice, setCartNotice] = useState("");
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    const fetchProductDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get(`/products/${slug}`);
        const prod = res.data;
        setProduct(prod);
        if (prod?.variants && prod.variants.length > 0) {
          // Select first active variant with stock, or just first active
          const firstInStock = prod.variants.find((v) => v.stock > 0) || prod.variants[0];
          setSelectedVariant(firstInStock);
        }
        if (prod?.images && prod.images.length > 0) {
          setActiveImage(prod.images[0]);
        }
      } catch (err) {
        setError(err.message || "Product not found or unavailable.");
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchProductDetail();
    }
  }, [slug]);

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    try {
      setIsAddingToCart(true);
      const res = await api.post("/cart/items", {
        productId: product._id,
        variantId: selectedVariant._id,
        quantity: 1
      });
      if (res.success && res.data?.cart) {
        dispatch(setCartItemCount(res.data.cart.totalItems || 0));
        setCartNotice(`Added ${product.name} to cart!`);
      }
    } catch (err) {
      alert(err.message || "Failed to add item to cart.");
    } finally {
      setIsAddingToCart(false);
      setTimeout(() => setCartNotice(""), 3500);
    }
  };

  const handleToggleWishlist = async () => {
    if (!product) return;
    try {
      setIsWishlistLoading(true);
      const res = await api.post("/wishlist/toggle", { productId: product._id });
      if (res.success) {
        setIsWishlisted((prev) => !prev);
      }
    } catch (err) {
      alert(err.message || "Please log in to manage your wishlist.");
    } finally {
      setIsWishlistLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-8 animate-pulse py-8">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div className="aspect-square bg-slate-200 rounded-2xl" />
          <div className="space-y-6">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-8 w-3/4 bg-slate-200 rounded" />
            <div className="h-10 w-1/3 bg-slate-200 rounded" />
            <div className="h-32 w-full bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-rose-50 text-rose-500 mb-4">
          <Package className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Product Unavailable</h2>
        <p className="mt-2 text-sm text-slate-500">{error || "This product may have been archived or removed."}</p>
        <Link
          to="/shop"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Catalog</span>
        </Link>
      </div>
    );
  }

  const { name, brand, category, description, images = [], variants = [] } = product;
  const isOutOfStock = !selectedVariant || selectedVariant.stock <= 0;

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-16">
      {/* Back Button & Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/shop" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Shop</span>
        </Link>
        <span>/</span>
        <span className="text-slate-400">{category?.name}</span>
        <span>/</span>
        <span className="font-semibold text-slate-800 line-clamp-1">{name}</span>
      </nav>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Images Column */}
        <div className="space-y-4">
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xs">
            {activeImage ? (
              <img src={activeImage} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <Package className="h-20 w-20 stroke-[1.5]" />
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg border-2 cursor-pointer transition-all ${
                    activeImage === img ? "border-indigo-600 ring-2 ring-indigo-600/30" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Information Column */}
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
              <span>{brand?.name}</span>
              <span>•</span>
              <span className="text-slate-500">{category?.name}</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold font-heading text-slate-900">{name}</h1>
          </div>

          {/* Interactive Variant Picker */}
          <VariantSelector
            variants={variants}
            selectedVariant={selectedVariant}
            onSelectVariant={(v) => setSelectedVariant(v)}
          />

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isOutOfStock || isAddingToCart}
                onClick={handleAddToCart}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-4 px-6 text-sm font-bold shadow-md transition-all ${
                  isOutOfStock
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    : "bg-slate-900 text-white hover:bg-indigo-600 cursor-pointer"
                }`}
              >
                <ShoppingBag className="h-5 w-5" />
                <span>{isAddingToCart ? "Adding..." : isOutOfStock ? "Out of Stock" : "Add to Cart"}</span>
              </button>

              <button
                type="button"
                disabled={isWishlistLoading}
                onClick={handleToggleWishlist}
                title="Save to Wishlist"
                className={`flex h-[52px] w-[52px] items-center justify-center rounded-xl border transition-all ${
                  isWishlisted
                    ? "border-rose-300 bg-rose-50 text-rose-600"
                    : "border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:text-rose-600"
                }`}
              >
                <Heart className={`h-5 w-5 ${isWishlisted ? "fill-rose-500 text-rose-500" : ""}`} />
              </button>
            </div>

            {cartNotice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-semibold text-emerald-800 animate-fade-in">
                {cartNotice}
              </div>
            )}
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-4 border-t border-b border-slate-100 py-6 text-center">
            <div className="flex flex-col items-center gap-1.5 text-xs text-slate-600">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold">100% Authentic</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-xs text-slate-600">
              <Truck className="h-5 w-5 text-indigo-600" />
              <span className="font-semibold">Free Express Delivery</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-xs text-slate-600">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              <span className="font-semibold">7-Day Easy Returns</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
