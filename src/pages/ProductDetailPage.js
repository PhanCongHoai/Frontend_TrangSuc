import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Footer from "./footer/Footer";
import Header from "./Header";
import {
  getBlockedProductIds,
  isProductBlocked,
  subscribeProductVisibilityChange,
} from "../utils/productSync";
import { getAuthHeaders, getCurrentUser } from "../utils/auth";
import { addCartItem } from "../utils/cart";
import {
  applyPricingContextToTiers,
  computeSalePrice,
  formatCurrency,
  formatTierRange,
  normalizePriceTiers,
  resolveTierPrice,
} from "../utils/pricing";
import {
  addCompareItem,
  fetchCompareConfig,
  getCompareConfig,
  getCompareItems,
  removeCompareItem,
  replaceCompareItemAt,
  subscribeCompareChange,
} from "../utils/compare";
import { buildApiUrl, buildAssetUrl } from "../utils/api";
import "./ProductDetailPage.css";

const FALLBACK_IMAGE =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ1xp79XGKoIg-gZeZiRg2G7mpp2A6kH-AWow&s";

function BuyNowIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 7.5A4 4 0 0 1 12 4a4 4 0 0 1 4 3.5" />
      <path d="M6.5 8.5h11l-1 10a1 1 0 0 1-1 .9H8.5a1 1 0 0 1-1-.9l-1-10Z" />
    </svg>
  );
}

function CartActionIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
      <path d="M3 5h2l2.2 8.5a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H7.2" />
    </svg>
  );
}

function CompareActionIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 5v14" />
      <path d="M7 8l-3 4h6l-3-4Z" />
      <path d="M17 16l-3-4h6l-3 4Z" />
      <path d="M5 19h14" />
    </svg>
  );
}

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState(FALLBACK_IMAGE);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [replyingToReviewId, setReplyingToReviewId] = useState(null);
  const [replyComment, setReplyComment] = useState("");
  const [replyError, setReplyError] = useState("");
  const [submittingReplyTo, setSubmittingReplyTo] = useState(null);
  const [cartFeedback, setCartFeedback] = useState("");
  const [cartError, setCartError] = useState("");
  const [compareFeedback, setCompareFeedback] = useState("");
  const [compareItems, setCompareItems] = useState(() => getCompareItems());
  const [compareMaxItems, setCompareMaxItems] = useState(() => getCompareConfig().maxItems);
  const [commentMenu, setCommentMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    reviewId: null,
  });
  const reviewTextareaRef = useRef(null);
  const reviewRefreshInFlightRef = useRef(false);

  const currentUser = useMemo(() => getCurrentUser(), []);

  const applyProductData = useCallback((nextProduct, preserveViewState = false) => {
    const normalizedProduct = {
      ...nextProduct,
      images: Array.isArray(nextProduct.images)
        ? nextProduct.images.map((item) => ({
            ...item,
            url: buildAssetUrl(item.url),
          }))
        : [],
    };
    const mainImage =
      normalizedProduct.images.find((item) => item.isMain)?.url ||
      normalizedProduct.images[0]?.url ||
      FALLBACK_IMAGE;

    setProduct(normalizedProduct);
    setActiveImage((currentImage) => {
      if (
        preserveViewState &&
        normalizedProduct.images.some((item) => item.url === currentImage)
      ) {
        return currentImage;
      }

      return mainImage;
    });
    setSelectedVariantId((currentVariantId) => {
      if (
        preserveViewState &&
        normalizedProduct.variants.some((item) => item.id === currentVariantId)
      ) {
        return currentVariantId;
      }

      return normalizedProduct.variants[0]?.id || null;
    });
  }, []);

  const fetchProductDetail = useCallback(async ({
    showLoading = true,
    preserveViewState = false,
  } = {}) => {
    if (showLoading) {
      setLoading(true);
    }

    setError("");

    if (isProductBlocked(Number(id))) {
      setProduct(null);
      setLoading(false);
      setError("Sản phẩm này đã bị ẩn hoặc không còn hiển thị.");
      return;
    }

    const response = await fetch(buildApiUrl(`/api/products/${id}`));
    const contentType = response.headers.get("content-type") || "";
    let data = null;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const rawText = await response.text();

      if (response.status === 404) {
        throw new Error(
          "Backend chưa có API chi tiết sản phẩm hoặc server chưa được khởi động lại. Hãy restart backend."
        );
      }

      throw new Error(
        rawText.includes("Cannot GET /api/products/")
          ? "Backend chưa nhận route /api/products/:id. Hãy restart backend để nạp code mới."
          : "Backend trả về dữ liệu không đúng định dạng JSON."
      );
    }

    if (!response.ok || !data.success || !data.product) {
      throw new Error(data.message || "Không thể tải dữ liệu sản phẩm.");
    }

    applyProductData(data.product, preserveViewState);
  }, [applyProductData, id]);

  useEffect(() => {
    const currentProductId = Number(id);

    return subscribeProductVisibilityChange(
      async ({ productId: changedProductId, blockedIds }) => {
        const nextBlockedIds = blockedIds || getBlockedProductIds();

        if (nextBlockedIds.includes(currentProductId)) {
          setProduct(null);
          setLoading(false);
          setError("Sản phẩm này đã bị ẩn hoặc không còn hiển thị.");
          return;
        }

        if (changedProductId === currentProductId || !changedProductId) {
          try {
            await fetchProductDetail({
              showLoading: false,
              preserveViewState: true,
            });
          } catch (fetchError) {
            setError(fetchError.message || "Không thể tải dữ liệu sản phẩm.");
          }
        }
      }
    );
  }, [fetchProductDetail, id]);

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      try {
        await fetchProductDetail();
      } catch (fetchError) {
        if (isMounted) {
          if (fetchError instanceof TypeError) {
            setError("Không kết nối được tới backend. Hãy kiểm tra server backend đang chạy.");
            return;
          }

          setError(fetchError.message || "Không thể tải dữ liệu sản phẩm.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [fetchProductDetail, id]);

  useEffect(() => {
    if (!product?.id) {
      return undefined;
    }

    const refreshReviews = async () => {
      if (
        reviewRefreshInFlightRef.current ||
        isSubmittingReview ||
        deletingReviewId ||
        submittingReplyTo ||
        document.visibilityState === "hidden"
      ) {
        return;
      }

      try {
        reviewRefreshInFlightRef.current = true;
        await fetchProductDetail({
          showLoading: false,
          preserveViewState: true,
        });
      } catch (refreshError) {
        console.error("Auto refresh product reviews error:", refreshError);
      } finally {
        reviewRefreshInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(refreshReviews, 6000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshReviews();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    deletingReviewId,
    fetchProductDetail,
    isSubmittingReview,
    product?.id,
    submittingReplyTo,
  ]);

  useEffect(() => {
    if (!commentMenu.visible) {
      return undefined;
    }

    const closeMenu = () => {
      setCommentMenu((current) => ({ ...current, visible: false }));
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [commentMenu.visible]);

  useEffect(() => {
    const unsubscribeCompare = subscribeCompareChange((items) => {
      setCompareItems(items);
    });

    fetchCompareConfig().then((config) => {
      setCompareMaxItems(config.maxItems);
    });

    return () => {
      unsubscribeCompare();
    };
  }, []);

  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length) {
      return null;
    }

    return (
      product.variants.find((item) => item.id === selectedVariantId) ||
      product.variants[0]
    );
  }, [product, selectedVariantId]);

  const priceTiers = useMemo(
    () => normalizePriceTiers(product?.pricing?.priceTiers),
    [product?.pricing?.priceTiers]
  );

  const selectedPricingContext = useMemo(
    () => ({
      baseSellPrice: Number(product?.pricing?.baseSellPrice || 0),
      baseWeight: Number(product?.material?.baseWeight || 0),
      weightModifier: Number(selectedVariant?.weightModifier || 0),
      laborCost: Number(product?.pricing?.laborCost || 0),
      stoneCost: Number(product?.pricing?.stoneCost || 0),
    }),
    [
      product?.material?.baseWeight,
      product?.pricing?.baseSellPrice,
      product?.pricing?.laborCost,
      product?.pricing?.stoneCost,
      selectedVariant?.weightModifier,
    ]
  );

  const selectedBasePrice = useMemo(
    () =>
      computeSalePrice({
        ...selectedPricingContext,
        markupRate: Number(product?.pricing?.markupRate || 0),
      }),
    [product?.pricing?.markupRate, selectedPricingContext]
  );

  const selectedPriceTiers = useMemo(
    () => applyPricingContextToTiers(priceTiers, selectedPricingContext),
    [priceTiers, selectedPricingContext]
  );

  const selectedUnitPrice = useMemo(
    () =>
      resolveTierPrice(
        priceTiers,
        purchaseQuantity,
        selectedBasePrice,
        selectedPricingContext
      ),
    [priceTiers, purchaseQuantity, selectedBasePrice, selectedPricingContext]
  );

  const selectedLineTotal = useMemo(
    () => selectedUnitPrice * Math.max(1, Number(purchaseQuantity || 1)),
    [purchaseQuantity, selectedUnitPrice]
  );

  useEffect(() => {
    setPurchaseQuantity((currentQuantity) => {
      const maxQuantity = Number(selectedVariant?.quantity || 0);

      if (maxQuantity > 0) {
        return Math.min(Math.max(1, currentQuantity), maxQuantity);
      }

      return 1;
    });
  }, [selectedVariant]);

  const autoResizeTextarea = (textarea) => {
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleTextareaSubmitShortcut = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleCommentContextMenu = (event, review) => {
    if (currentUser?.id !== review.userId) {
      return;
    }

    event.preventDefault();
    setCommentMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      reviewId: review.id,
    });
  };

  const resolveShippingWeight = (baseWeight, weightModifier) => {
    const normalizedWeight = Number(baseWeight || 0) + Number(weightModifier || 0);

    if (normalizedWeight > 0) {
      return Math.max(100, Math.round(normalizedWeight));
    }

    return 500;
  };

  const getSelectedPurchaseItem = () => {
    if (!product) {
      setCartError("Kh?ng th? x? l? s?n ph?m l?c n?y.");
      return null;
    }

    if (!selectedVariant) {
      setCartError("Vui l?ng ch?n bi?n th? s?n ph?m tr??c khi ti?p t?c.");
      return null;
    }

    if (Number(selectedVariant.quantity || 0) <= 0) {
      setCartError("Bi?n th? n?y ?ang t?m h?t h?ng.");
      return null;
    }

    return {
      productId: Number(product.id),
      variantId: Number(selectedVariant.id),
      name: product.name,
      image: activeImage || product.images[0]?.url || FALLBACK_IMAGE,
      size: selectedVariant.size || "Chu?n",
      stockLabel: `${Number(selectedVariant.quantity || 0)} s?n ph?m`,
      price: selectedUnitPrice,
      basePrice: selectedBasePrice,
      baseSellPrice: Number(product.pricing?.baseSellPrice || 0),
      laborCost: Number(product.pricing?.laborCost || 0),
      stoneCost: Number(product.pricing?.stoneCost || 0),
      baseWeight: Number(product.material?.baseWeight || 0),
      weightModifier: Number(selectedVariant.weightModifier || 0),
      shippingWeight: resolveShippingWeight(
        product.material?.baseWeight,
        selectedVariant.weightModifier
      ),
      priceTiers: selectedPriceTiers,
      formattedPrice: formatCurrency(selectedUnitPrice),
      quantity: purchaseQuantity,
      maxQuantity: Number(selectedVariant.quantity || 0),
    };
  };

  const handleAddToCart = (shouldNavigateToCart = false) => {
    setCartFeedback("");
    setCartError("");

    if (!currentUser) {
      navigate("/login", {
        state: {
          from: location.pathname,
        },
      });
      return;
    }

    const purchaseItem = getSelectedPurchaseItem();

    if (!purchaseItem) {
      return;
    }

    const result = addCartItem(purchaseItem);

    setCartFeedback(
      result.reachedStockLimit
        ? "S?n ph?m ?? ???c th?m t?i m?c t?n kho hi?n c?."
        : "?? th?m s?n ph?m v?o gi? h?ng."
    );

    if (shouldNavigateToCart) {
      navigate("/cart");
    }
  };

  const handleBuyNow = () => {
    setCartFeedback("");
    setCartError("");

    if (!currentUser) {
      navigate("/login", {
        state: {
          from: location.pathname,
        },
      });
      return;
    }

    const purchaseItem = getSelectedPurchaseItem();

    if (!purchaseItem) {
      return;
    }

    navigate("/checkout", {
      state: {
        source: "buy-now",
        items: [purchaseItem],
      },
    });
  };

  const handleToggleCompare = () => {
    if (!product) {
      return;
    }

    const productId = Number(product.id);
    const isSelected = compareItems.some((item) => Number(item.productId) === productId);

    if (isSelected) {
      removeCompareItem(productId);
      setCompareFeedback("Đã bỏ sản phẩm khỏi danh sách so sánh.");
      return;
    }

    const nextCompareItem = {
      productId,
      name: product.name,
      image: activeImage || product.images[0]?.url || FALLBACK_IMAGE,
      price: formatCurrency(selectedUnitPrice),
      material: product.material?.label || "",
      category: product.category?.name || "",
    };

    const result = addCompareItem(nextCompareItem, compareMaxItems);

    if (result.status === "added") {
      setCompareFeedback("Đã thêm sản phẩm vào danh sách so sánh.");
      return;
    }

    if (result.status === "requires_replace" && Array.isArray(result.items) && result.items.length) {
      const firstItem = result.items[0];
      const secondItem = result.items[1];
      const shouldReplaceFirst = window.confirm(
        `Đã đủ ${compareMaxItems} sản phẩm.\nOK: Thay "${firstItem?.name || "Sản phẩm 1"}"\nCancel: Thay "${secondItem?.name || "Sản phẩm 2"}"`
      );
      const targetIndex = shouldReplaceFirst ? 0 : 1;
      const replaceResult = replaceCompareItemAt(targetIndex, nextCompareItem, compareMaxItems);

      if (replaceResult.status === "replaced") {
        setCompareFeedback("Đã thay sản phẩm trong danh sách so sánh.");
        return;
      }
    }

    setCompareFeedback("Không thể thêm sản phẩm để so sánh lúc này.");
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();

    if (isSubmittingReview) {
      return;
    }

    setReviewError("");
    setReplyError("");

    if (!currentUser) {
      navigate("/login", {
        state: {
          from: location.pathname,
        },
      });
      return;
    }

    if (reviewComment.trim().length < 3) {
      setReviewError("Vui lòng nhập nội dung đánh giá ít nhất 3 ký tự.");
      return;
    }

    try {
      setIsSubmittingReview(true);

      const response = await fetch(buildApiUrl(`/api/products/${id}/reviews`), {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể gửi đánh giá.");
      }

      setReviewComment("");
      setReviewRating(5);
      if (reviewTextareaRef.current) {
        reviewTextareaRef.current.style.height = "";
      }
      await fetchProductDetail({
        showLoading: false,
        preserveViewState: true,
      });
    } catch (submitError) {
      if (submitError instanceof TypeError) {
        setReviewError("Không thể kết nối đến backend. Hãy kiểm tra server backend.");
      } else {
        setReviewError(submitError.message || "Không thể gửi đánh giá.");
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!currentUser || deletingReviewId) {
      return;
    }

    setReviewError("");
    setReplyError("");

    try {
      setDeletingReviewId(reviewId);

      const response = await fetch(
        buildApiUrl(`/api/products/${id}/reviews/${reviewId}`),
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể xóa bình luận.");
      }

      await fetchProductDetail({
        showLoading: false,
        preserveViewState: true,
      });
      setCommentMenu((current) => ({ ...current, visible: false }));
    } catch (deleteError) {
      if (deleteError instanceof TypeError) {
        setReviewError("Không thể kết nối đến backend. Hãy kiểm tra server backend.");
      } else {
        setReviewError(deleteError.message || "Không thể xóa bình luận.");
      }
    } finally {
      setDeletingReviewId(null);
    }
  };

  const handleReplySubmit = async (event, parentId) => {
    event.preventDefault();

    if (submittingReplyTo) {
      return;
    }

    setReviewError("");
    setReplyError("");

    if (!currentUser) {
      navigate("/login", {
        state: {
          from: location.pathname,
        },
      });
      return;
    }

    if (replyComment.trim().length < 3) {
      setReplyError("Vui lòng nhập nội dung trả lời ít nhất 3 ký tự.");
      return;
    }

    try {
      setSubmittingReplyTo(parentId);

      const response = await fetch(buildApiUrl(`/api/products/${id}/reviews`), {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          parentId,
          comment: replyComment.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể gửi trả lời.");
      }

      setReplyComment("");
      setReplyingToReviewId(null);
      await fetchProductDetail({
        showLoading: false,
        preserveViewState: true,
      });
    } catch (submitError) {
      if (submitError instanceof TypeError) {
        setReplyError("Không thể kết nối đến backend. Hãy kiểm tra server backend.");
      } else {
        setReplyError(submitError.message || "Không thể gửi trả lời.");
      }
    } finally {
      setSubmittingReplyTo(null);
    }
  };

  const renderCommentItems = (items = [], isReplyLevel = false) =>
    items.map((item) => (
      <div className="product-comment-thread" key={item.id}>
        <div
          className={`product-comment${isReplyLevel ? " reply" : ""}`}
          onContextMenu={(event) => handleCommentContextMenu(event, item)}
        >
          <div className="product-comment-avatar" aria-hidden="true">
            {String(item.author || "U").trim().charAt(0).toUpperCase()}
          </div>
          <div className="product-comment-body">
            <div
              className={`product-comment-bubble${
                isReplyLevel ? " product-comment-bubble-reply" : ""
              }`}
            >
              <strong>{item.author}</strong>
              <p>{item.comment}</p>
              {!isReplyLevel ? (
                <p className="product-review-rating">{`${item.rating}/5 sao`}</p>
              ) : null}
            </div>
            <div className="product-comment-meta">
              <span>{item.createdAtLabel}</span>
              <button type="button" className="product-comment-action">
                Thích
              </button>
              <button
                type="button"
                className="product-comment-action"
                onClick={() => {
                  setReplyError("");
                  setReplyingToReviewId((currentId) =>
                    currentId === item.id ? null : item.id
                  );
                }}
              >
                {replyingToReviewId === item.id ? "Đóng" : "Trả lời"}
              </button>
            </div>
          </div>
        </div>

        {replyingToReviewId === item.id ? (
          <form
            className="product-review-reply-form"
            onSubmit={(event) => handleReplySubmit(event, item.id)}
          >
            <textarea
              className="product-review-textarea product-review-reply-textarea"
              placeholder="Nhập trả lời của bạn..."
              value={replyComment}
              onChange={(event) => setReplyComment(event.target.value)}
              onKeyDown={handleTextareaSubmitShortcut}
              rows={1}
            />
            {replyError ? <p className="product-review-feedback error">{replyError}</p> : null}
          </form>
        ) : null}

        {item.replies?.length ? (
          <div className="product-review-reply-list">
            {renderCommentItems(item.replies, true)}
          </div>
        ) : null}
      </div>
    ));

  if (loading) {
    return (
      <div className="product-detail-page">
        <Header />
        <main className="product-detail-shell">
          <div className="product-detail-state">Đang tải chi tiết sản phẩm...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-detail-page">
        <Header />
        <main className="product-detail-shell">
          <div className="product-detail-state product-detail-state-error">
            <h1>Không tìm thấy sản phẩm</h1>
            <p>{error || "Sản phẩm đã bị xóa hoặc không tồn tại."}</p>
            <Link to="/" className="product-detail-back">
              Quay lại trang chủ
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const gallery = product.images.length
    ? product.images
    : [{ id: "fallback", url: FALLBACK_IMAGE, isMain: true }];

  return (
    <div className="product-detail-page">
      <Header />

      <main className="product-detail-shell">
        {commentMenu.visible ? (
          <button
            type="button"
            className="product-comment-menu"
            style={{ top: commentMenu.y, left: commentMenu.x }}
            onClick={() => handleDeleteReview(commentMenu.reviewId)}
          >
            Xóa bình luận
          </button>
        ) : null}

        <div className="product-breadcrumbs">
          <Link to="/">Trang chủ</Link>
          <span>/</span>
          <span>{product.category.parentName || product.category.name}</span>
          <span>/</span>
          <strong>{product.name}</strong>
        </div>

        <section className="product-detail-hero">
          <div className="product-detail-media-column">
            <div className="product-gallery-panel">
              <div className="product-gallery-main">
                <img
                  className="product-gallery-main-image"
                  src={activeImage}
                  alt={product.name}
                  loading="eager"
                  decoding="async"
                />
              </div>

              <div className="product-gallery-thumbs">
                {gallery.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    className={`product-gallery-thumb ${
                      activeImage === image.url ? "active" : ""
                    }`}
                    onClick={() => setActiveImage(image.url)}
                    aria-label={`Xem ảnh ${product.name}`}
                  >
                    <img
                      src={image.url}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            </div>

            <section className="product-review-section">
              <article className="product-info-card product-review-card">
                <div className="product-section-heading">
                  <p>{"Đánh giá"}</p>
                  <h2>{"Cảm nhận từ khách hàng"}</h2>
                </div>

                <form className="product-review-form" onSubmit={handleReviewSubmit}>
                  <div className="product-review-form-top">
                    <div>
                      <span className="product-review-form-label">{"Số sao đánh giá"}</span>
                      <div className="product-review-stars" role="radiogroup" aria-label={"Số sao đánh giá"}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className={`product-review-star ${
                              reviewRating >= star ? "active" : ""
                            }`}
                            onClick={() => setReviewRating(star)}
                            aria-label={`${star} sao`}
                          >
                            {"★"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <textarea
                    ref={reviewTextareaRef}
                    className="product-review-textarea"
                    placeholder={"Chia sẻ trải nghiệm của bạn về sản phẩm này..."}
                    value={reviewComment}
                    onChange={(event) => {
                      setReviewComment(event.target.value);
                      autoResizeTextarea(event.target);
                    }}
                    onKeyDown={handleTextareaSubmitShortcut}
                    rows={1}
                  />

                  {reviewError ? <p className="product-review-feedback error">{reviewError}</p> : null}
                </form>

                {product.reviews.items.length ? (
                  <div className="product-review-list">
                    {renderCommentItems(product.reviews.items)}
                  </div>
                ) : (
                  <p className="product-empty-copy">
                    {"Chưa có đánh giá được duyệt cho sản phẩm này."}
                  </p>
                )}
              </article>
            </section>
          </div>

          <div className="product-detail-panel">
            <p className="product-detail-kicker">
              {product.category.parentName
                ? `${product.category.parentName} / ${product.category.name}`
                : product.category.name}
            </p>
            <h1>{product.name}</h1>
            {product.description ? (
              <p className="product-detail-description">{product.description}</p>
            ) : null}

            <div className="product-detail-price">
              <strong>{formatCurrency(selectedUnitPrice)}</strong>
              <span>
                {"Giá chất liệu: "}{product.pricing.formattedBaseSellPrice}{" / đơn vị"}
              </span>
              {selectedPriceTiers.length ? (
                <span>{`Tạm tính ${formatCurrency(selectedLineTotal)} cho ${purchaseQuantity} sản phẩm`}</span>
              ) : null}
            </div>

            <div className="product-detail-meta-grid">
              <div>
                <span>{"Chất liệu"}</span>
                <strong>{product.material.label}</strong>
              </div>
              <div>
                <span>{"Trọng lượng nền"}</span>
                <strong>{product.material.baseWeight} chi</strong>
              </div>
              <div>
                <span>{"Tồn kho"}</span>
                <strong>{product.summary.inStockQuantity} {"sản phẩm"}</strong>
              </div>
              <div>
                <span>{"Đánh giá"}</span>
                <strong>
                  {product.reviews.averageRating}/5 ({product.reviews.total})
                </strong>
              </div>
            </div>

            {product.variants.length ? (
              <div className="product-variant-block">
                <p>{"Lựa chọn biến thể"}</p>
                <div className="product-variant-list">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      className={`product-variant-pill ${
                        selectedVariant?.id === variant.id ? "active" : ""
                      }`}
                      onClick={() => setSelectedVariantId(variant.id)}
                    >
                      {variant.size}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="product-purchase-quantity">
              <p>Số lượng mua</p>
              <div className="product-purchase-quantity-row">
                <input
                  type="number"
                  min="1"
                  max={Number(selectedVariant?.quantity || 1)}
                  inputMode="numeric"
                  value={purchaseQuantity}
                  onChange={(event) =>
                    setPurchaseQuantity(
                      Math.max(
                        1,
                        Math.min(
                          Number(selectedVariant?.quantity || 1),
                          Number(event.target.value || 1)
                        )
                      )
                    )
                  }
                />
                <span>{`Tồn kho: ${Number(selectedVariant?.quantity || 0)}`}</span>
              </div>
            </div>

            {selectedPriceTiers.length ? (
              <div className="product-tier-pricing">
                <p>Bảng giá theo số lượng</p>
                <div className="product-tier-pricing-list">
                  {selectedPriceTiers.map((tier) => {
                    const isActive =
                      purchaseQuantity >= tier.minQuantity &&
                      (tier.maxQuantity === null || purchaseQuantity <= tier.maxQuantity);

                    return (
                      <div
                        key={tier.id || `${tier.minQuantity}-${tier.maxQuantity ?? "plus"}`}
                        className={`product-tier-pricing-item${isActive ? " active" : ""}`}
                      >
                        <span>{formatTierRange(tier.minQuantity, tier.maxQuantity)}</span>
                        <strong>{formatCurrency(tier.price)}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="product-purchase-actions">
              <button
                type="button"
                className="product-buy-now-button"
                onClick={handleBuyNow}
              >
                <span className="product-action-content">
                  <BuyNowIcon className="product-action-icon" />
                  <span>Mua ngay</span>
                </span>
              </button>
              <button
                type="button"
                className="product-buy-button"
                onClick={() => handleAddToCart(false)}
              >
                <span className="product-action-content">
                  <CartActionIcon className="product-action-icon" />
                  <span>Thêm vào giỏ hàng</span>
                </span>
              </button>
              <button
                type="button"
                className={`product-compare-toggle${
                  compareItems.some((item) => Number(item.productId) === Number(product.id))
                    ? " active"
                    : ""
                }`}
                onClick={handleToggleCompare}
              >
                <span className="product-action-content">
                  <CompareActionIcon className="product-action-icon" />
                  <span>
                    {compareItems.some((item) => Number(item.productId) === Number(product.id))
                      ? "Đã thêm để so sánh"
                      : compareItems.length >= compareMaxItems
                      ? "Thay vào so sánh"
                      : "So sánh sản phẩm này"}
                  </span>
                </span>
              </button>
            </div>
            {cartError ? <p className="product-cart-feedback error">{cartError}</p> : null}
            {!cartError && cartFeedback ? (
              <p className="product-cart-feedback">{cartFeedback}</p>
            ) : null}
            {compareFeedback ? <p className="product-cart-feedback">{compareFeedback}</p> : null}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default ProductDetailPage;

