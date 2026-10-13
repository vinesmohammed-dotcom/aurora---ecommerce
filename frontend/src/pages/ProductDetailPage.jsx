import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import api from "../services/api";
import { setCartItemCount } from "../store/slices/cartSlice";
import VariantSelector from "../components/catalog/VariantSelector";
import ProductCard from "../components/catalog/ProductCard";
import StarRating from "../features/reviews/StarRating";
import ProductReviewsSection from "../features/reviews/ProductReviewsSection";
import {
  Package,
  ShoppingBag,
  ArrowLeft,
  ShieldCheck,
  Truck,
  RotateCcw,
  Heart,
  ZoomIn,
  ZoomOut,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartNotice, setCartNotice] = useState("");
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Image Zoom & Lightbox State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isMagnified, setIsMagnified] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
          if (firstInStock?.images && firstInStock.images.length > 0) {
            setActiveImage(firstInStock.images[0]);
          } else if (prod?.images && prod.images.length > 0) {
            setActiveImage(prod.images[0]);
          }
        } else if (prod?.images && prod.images.length > 0) {
          setActiveImage(prod.images[0]);
        }
      } catch (err) {
        setError(err.message || "Product not found or unavailable.");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchRelated = async () => {
      try {
        const res = await api.get(`/products/${slug}/related?limit=4`);
        if (res.success && res.data) {
          setRelatedProducts(res.data.products || res.data || []);
        }
      } catch (err) {
        console.error("Failed to load related products:", err);
      }
    };

    if (slug) {
      fetchProductDetail();
      fetchRelated();
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

  // Aggregate all available images from product and variant
  const allImages = useMemo(() => {
    const list = [];
    if (Array.isArray(product?.images)) {
      list.push(...product.images);
    }
    if (Array.isArray(selectedVariant?.images)) {
      list.push(...selectedVariant.images);
    }
    const cleanList = list.filter((img) => typeof img === "string" && img.trim().length > 0);
    return Array.from(new Set(cleanList));
  }, [product?.images, selectedVariant?.images]);

  const handleSelectVariant = (v) => {
    setSelectedVariant(v);
    if (v?.images && v.images.length > 0 && v.images[0]) {
      setActiveImage(v.images[0]);
    }
  };

  const handlePrevImage = useCallback(() => {
    if (allImages.length <= 1) return;
    const currentIndex = allImages.indexOf(activeImage);
    const newIndex = currentIndex <= 0 ? allImages.length - 1 : currentIndex - 1;
    setActiveImage(allImages[newIndex]);
  }, [allImages, activeImage]);

  const handleNextImage = useCallback(() => {
    if (allImages.length <= 1) return;
    const currentIndex = allImages.indexOf(activeImage);
    const newIndex = currentIndex >= allImages.length - 1 ? 0 : currentIndex + 1;
    setActiveImage(allImages[newIndex]);
  }, [allImages, activeImage]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
      } else if (e.key === "ArrowLeft") {
        handlePrevImage();
      } else if (e.key === "ArrowRight") {
        handleNextImage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, handlePrevImage, handleNextImage]);

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - left) / width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - top) / height) * 100));
    setMousePos({ x, y });
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

  const currentDisplayImage = activeImage || (allImages.length > 0 ? allImages[0] : null);
  const { name = "", brand, category, description, variants = [] } = product || {};
  const isOutOfStock = !selectedVariant || selectedVariant.stock <= 0;

  return (
    <div className="mx-auto max-w-6xl space-y-12 pb-16">
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
          <div
            className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xs cursor-zoom-in"
            onMouseEnter={() => setIsMagnified(true)}
            onMouseLeave={() => setIsMagnified(false)}
            onMouseMove={handleMouseMove}
            onClick={() => setIsLightboxOpen(true)}
            title="Click to view full-screen zoom"
          >
            {currentDisplayImage ? (
              <img
                src={currentDisplayImage}
                alt={name}
                className="h-full w-full object-cover transition-transform duration-200"
                style={
                  isMagnified
                    ? {
                        transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
                        transform: "scale(1.9)"
                      }
                    : { transform: "scale(1)" }
                }
                onError={(e) => {
                  e.target.src = "https://placehold.co/600x600/png?text=Image+Unavailable";
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <Package className="h-20 w-20 stroke-[1.5]" />
              </div>
            )}

            {/* Zoom Indicator Badge */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-slate-900/75 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-xs pointer-events-none transition-opacity group-hover:bg-slate-900">
              <ZoomIn className="h-3.5 w-3.5" />
              <span>Zoom</span>
            </div>
          </div>

          {/* Selectable Thumbnails Strip */}
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg border-2 cursor-pointer transition-all ${
                    currentDisplayImage === img
                      ? "border-indigo-600 ring-2 ring-indigo-600/30"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  aria-label={`Select product image ${idx + 1}`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.target.src = "https://placehold.co/120x120/png?text=Thumb";
                    }}
                  />
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
            {product?.rating && product.rating.count > 0 ? (
              <div className="mt-2 flex items-center gap-2">
                <StarRating rating={product.rating.average} size="sm" readOnly />
                <span className="text-xs font-bold text-slate-800">
                  {product.rating.average.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">
                  ({product.rating.count} {product.rating.count === 1 ? "review" : "reviews"})
                </span>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                <StarRating rating={0} size="sm" readOnly />
                <span>No reviews yet</span>
              </div>
            )}
          </div>

          {/* Interactive Variant Picker */}
          <VariantSelector
            variants={variants}
            selectedVariant={selectedVariant}
            onSelectVariant={handleSelectVariant}
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

      {/* Related Products Section */}
      {relatedProducts && relatedProducts.length > 0 && (
        <section className="pt-10 border-t border-slate-200" aria-labelledby="related-products-title">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 id="related-products-title" className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
                Related Products
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Curated luxury pieces matching this style and collection
              </p>
            </div>
            <Link
              to="/shop"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
            >
              Explore Collection →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {relatedProducts.map((relProduct) => (
              <ProductCard key={relProduct._id} product={relProduct} />
            ))}
          </div>
        </section>
      )}

      {/* Customer Product Ratings & Reviews Section */}
      <ProductReviewsSection product={product} />

      {/* Full-Screen Accessible Image Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Image Zoom Lightbox"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-5 right-5 z-20 rounded-full bg-slate-800/80 p-2.5 text-white hover:bg-slate-700 transition cursor-pointer"
            aria-label="Close image zoom"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Previous Image Button */}
          {allImages.length > 1 && (
            <button
              type="button"
              onClick={handlePrevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-800/80 p-3 text-white hover:bg-slate-700 transition cursor-pointer"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Next Image Button */}
          {allImages.length > 1 && (
            <button
              type="button"
              onClick={handleNextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-800/80 p-3 text-white hover:bg-slate-700 transition cursor-pointer"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Center Zoom View */}
          <div className="relative flex max-h-[85vh] max-w-4xl flex-col items-center justify-center overflow-hidden">
            <img
              src={currentDisplayImage}
              alt={name}
              className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-300"
              onError={(e) => {
                e.target.src = "https://placehold.co/800x800/png?text=Image+Unavailable";
              }}
            />

            {/* Thumbnail Strip inside Modal */}
            {allImages.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto p-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      currentDisplayImage === img ? "border-indigo-400 ring-2 ring-indigo-400/40" : "border-slate-700 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
