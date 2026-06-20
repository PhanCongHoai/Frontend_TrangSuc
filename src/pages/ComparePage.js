import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "./footer/Footer";
import Header from "./Header";
import {
  clearCompareItems,
  fetchCompareConfig,
  getCompareConfig,
  getCompareItems,
  removeCompareItem,
  subscribeCompareChange,
} from "../utils/compare";
import { buildApiUrl, buildAssetUrl } from "../utils/api";
import { getBlockedProductIds, subscribeProductVisibilityChange } from "../utils/productSync";
import { formatWeightInGrams } from "../utils/weight";
import "./ComparePage.css";

const API_BASE_URL = buildApiUrl("/api/products");
const COMPARE_UNAVAILABLE_MESSAGE =
  "Một hoặc nhiều sản phẩm đã ngừng hiển thị. Hãy bỏ sản phẩm đó và chọn lại.";

const parseJsonResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(
        rawText.includes("<!DOCTYPE")
          ? "Backend chưa sẵn sàng hoặc route compare chưa hoạt động. Hãy kiểm tra server backend."
          : "API compare trả về dữ liệu không đúng định dạng JSON."
      );
    }

    throw new Error("API compare trả về dữ liệu không đúng định dạng JSON.");
  }

  return response.json();
};

const normalizeCompareErrorMessage = (message) => {
  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    return "Không thể lấy dữ liệu so sánh.";
  }

  if (/unavailable for comparison/i.test(normalizedMessage)) {
    return COMPARE_UNAVAILABLE_MESSAGE;
  }

  return normalizedMessage;
};

function ComparePage() {
  const [compareItems, setCompareItems] = useState(() => getCompareItems());
  const [compareConfig, setCompareConfig] = useState(() => getCompareConfig());
  const [comparedProducts, setComparedProducts] = useState([]);
  const [unavailableProductIds, setUnavailableProductIds] = useState([]);
  const [reviewsByProduct, setReviewsByProduct] = useState({});
  const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeCompareChange((items) => {
      setCompareItems(items);
    });

    fetchCompareConfig().then((config) => {
      setCompareConfig(config);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    return subscribeProductVisibilityChange(({ productId, blockedIds }) => {
      const nextBlockedIds = Array.isArray(blockedIds) ? blockedIds : getBlockedProductIds();
      const comparedIds = getCompareItems().map((item) => Number(item.productId));

      comparedIds
        .filter((id) => nextBlockedIds.includes(id))
        .forEach((id) => removeCompareItem(id));

      if (!productId || comparedIds.includes(Number(productId))) {
        setReviewsRefreshKey((currentValue) => currentValue + 1);
      }
    });
  }, []);

  const compareIds = useMemo(
    () => compareItems.map((item) => Number(item.productId)).filter((item) => item > 0),
    [compareItems]
  );

  useEffect(() => {
    const loadComparedProducts = async () => {
      if (compareIds.length !== compareConfig.requiredItems) {
        setComparedProducts([]);
        setUnavailableProductIds([]);
        setReviewsByProduct({});
        setError("");
        return;
      }

      try {
        setLoading(true);
        setError("");
        setUnavailableProductIds([]);

        const response = await fetch(`${API_BASE_URL}/compare/preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ productIds: compareIds }),
        });
        const data = await parseJsonResponse(response);

        if (!response.ok || !data?.success || !Array.isArray(data.comparedProducts)) {
          setComparedProducts(Array.isArray(data?.comparedProducts) ? data.comparedProducts : []);
          setUnavailableProductIds(
            Array.isArray(data?.unavailableProductIds)
              ? data.unavailableProductIds
                  .map((productId) => Number(productId))
                  .filter((productId) => productId > 0)
              : []
          );
          throw new Error(normalizeCompareErrorMessage(data?.message));
        }

        setComparedProducts(data.comparedProducts);
        setUnavailableProductIds([]);
      } catch (fetchError) {
        if (fetchError instanceof TypeError) {
          setComparedProducts([]);
          setUnavailableProductIds([]);
          setError("Không thể kết nối tới backend. Hãy kiểm tra server backend.");
        } else {
          setError(normalizeCompareErrorMessage(fetchError.message));
        }
      } finally {
        setLoading(false);
      }
    };

    loadComparedProducts();
  }, [compareConfig.requiredItems, compareIds]);

  useEffect(() => {
    const loadReviews = async () => {
      if (comparedProducts.length !== compareConfig.requiredItems) {
        setReviewsByProduct({});
        return;
      }

      try {
        const reviewResults = await Promise.all(
          comparedProducts.map(async (product) => {
            const response = await fetch(`${API_BASE_URL}/${product.id}`);
            const data = await parseJsonResponse(response);

            if (!response.ok || !data?.success || !data?.product) {
              return [product.id, { averageRating: 0, total: 0, items: [] }];
            }

            const reviews = data.product.reviews || {};
            const topComments = Array.isArray(reviews.items) ? reviews.items.slice(0, 3) : [];

            return [
              product.id,
              {
                averageRating: Number(reviews.averageRating || 0),
                total: Number(reviews.total || 0),
                items: topComments,
              },
            ];
          })
        );

        setReviewsByProduct(Object.fromEntries(reviewResults));
      } catch (reviewError) {
        setReviewsByProduct({});
      }
    };

    loadReviews();
  }, [compareConfig.requiredItems, comparedProducts, reviewsRefreshKey]);

  useEffect(() => {
    if (compareIds.length !== compareConfig.requiredItems) {
      return undefined;
    }

    const refreshIntervalId = window.setInterval(() => {
      setReviewsRefreshKey((currentValue) => currentValue + 1);
    }, 5000);

    const refreshOnWindowFocus = () => {
      setReviewsRefreshKey((currentValue) => currentValue + 1);
    };

    window.addEventListener("focus", refreshOnWindowFocus);

    return () => {
      window.clearInterval(refreshIntervalId);
      window.removeEventListener("focus", refreshOnWindowFocus);
    };
  }, [compareConfig.requiredItems, compareIds]);

  const canCompare = compareIds.length === compareConfig.requiredItems;
  const shouldShowSelectedItems = !canCompare || Boolean(error);

  const renderReviewThread = (items = [], isReplyLevel = false) =>
    items.map((item) => (
      <article
        key={item.id}
        className={`compare-review-item${isReplyLevel ? " reply" : ""}`}
      >
        <strong>{item.author}</strong>
        <p>{item.comment}</p>
        {Array.isArray(item.replies) && item.replies.length ? (
          <div className="compare-review-children">
            {renderReviewThread(item.replies, true)}
          </div>
        ) : null}
      </article>
    ));

  const renderStars = (rating) => {
    const fullStars = Math.round(rating);
    return (
      <span className="compare-stars">
        {"★".repeat(fullStars)}
        {"☆".repeat(5 - fullStars)}
      </span>
    );
  };

  const renderSlot = (item, slotIndex, placeholderText) => {
    if (item) {
      const isUnavailable = unavailableProductIds.includes(Number(item.productId));
      return (
        <article className={`compare-slot-card${isUnavailable ? " unavailable" : ""}`}>
          <div className="compare-slot-img-wrapper">
            <img
              src={buildAssetUrl(item.image)}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className="compare-slot-image"
            />
            <button
              type="button"
              className="compare-slot-close-btn"
              onClick={() => removeCompareItem(item.productId)}
              aria-label="Xóa sản phẩm"
            >
              &times;
            </button>
          </div>
          <div className="compare-slot-info">
            <strong className="compare-slot-name">{item.name}</strong>
            <p className="compare-slot-price">{item.price || "Chưa có giá"}</p>
            {isUnavailable ? (
              <span className="compare-slot-status">Không còn khả dụng</span>
            ) : null}
          </div>
        </article>
      );
    }

    return (
      <div className="compare-slot-card compare-slot-empty">
        <Link to="/" className="compare-slot-dashed-trigger">
          <span className="compare-slot-plus">+</span>
          <span className="compare-slot-placeholder-text">{placeholderText}</span>
        </Link>
      </div>
    );
  };

  const renderSelectedItems = (title) => (
    <section className="compare-incomplete-card">
      <h2>{title}</h2>
      {error ? <p className="compare-selected-help">{COMPARE_UNAVAILABLE_MESSAGE}</p> : null}
      <div className="compare-slots-container">
        {renderSlot(compareItems[0], 0, "Chọn sản phẩm thứ nhất")}
        {renderSlot(compareItems[1], 1, "Chọn sản phẩm thứ hai")}
      </div>
    </section>
  );

  return (
    <div className="compare-page">
      <Header />

      <main className="compare-shell">
        <section className="compare-header-card">
          <div className="compare-header-content">
            <p className="compare-kicker">So sánh sản phẩm</p>
            <h1>Chỉ so sánh 2 sản phẩm</h1>
            <p className="compare-subtitle">
              Đã chọn <strong>{compareIds.length}</strong>/{compareConfig.maxItems} sản phẩm.
            </p>
          </div>
          <div className="compare-header-actions">
            <button type="button" className="compare-clear-button" onClick={() => clearCompareItems()}>
              Xóa tất cả
            </button>
            <Link to="/" className="compare-back-link">
              Chọn thêm sản phẩm
            </Link>
          </div>
        </section>

        {shouldShowSelectedItems
          ? renderSelectedItems(
              canCompare
                ? "Chọn lại sản phẩm để tiếp tục so sánh"
                : "Chọn đủ 2 sản phẩm để bắt đầu so sánh"
            )
          : null}

        {canCompare ? (
          <section className="compare-table-card">
            {loading ? <p>Đang tải dữ liệu so sánh...</p> : null}
            {!loading && error ? <p className="compare-error">{error}</p> : null}
            {!loading && !error && comparedProducts.length === compareConfig.requiredItems ? (
              <div className="compare-table">
                <div className="compare-row compare-row-head">
                  <div className="compare-cell label">Sản phẩm</div>
                  {comparedProducts.map((product) => (
                    <div className="compare-cell compare-header-cell" key={product.id}>
                      <div className="compare-image-container">
                        <img src={buildAssetUrl(product.image)} alt={product.name} />
                        <button
                          type="button"
                          className="compare-cell-close-btn"
                          onClick={() => removeCompareItem(product.id)}
                          aria-label="Xóa sản phẩm"
                        >
                          &times;
                        </button>
                      </div>
                      <h3>{product.name}</h3>
                    </div>
                  ))}
                </div>

                <div className="compare-row">
                  <div className="compare-cell label">Giá</div>
                  {comparedProducts.map((product) => (
                    <div className="compare-cell" key={`${product.id}-price`}>
                      {product.formattedSalePrice}
                    </div>
                  ))}
                </div>

                <div className="compare-row">
                  <div className="compare-cell label">Danh mục</div>
                  {comparedProducts.map((product) => (
                    <div className="compare-cell" key={`${product.id}-category`}>
                      {product.category}
                    </div>
                  ))}
                </div>

                <div className="compare-row">
                  <div className="compare-cell label">Chất liệu</div>
                  {comparedProducts.map((product) => (
                    <div className="compare-cell" key={`${product.id}-material`}>
                      {product.materialLabel}
                    </div>
                  ))}
                </div>

                <div className="compare-row">
                  <div className="compare-cell label">Trọng lượng nền</div>
                  {comparedProducts.map((product) => (
                    <div className="compare-cell" key={`${product.id}-weight`}>
                      {formatWeightInGrams(product.baseWeight)}
                    </div>
                  ))}
                </div>

                <div className="compare-row">
                  <div className="compare-cell label">Tồn kho</div>
                  {comparedProducts.map((product) => (
                    <div className="compare-cell" key={`${product.id}-stock`}>
                      {product.stockQuantity} sản phẩm
                    </div>
                  ))}
                </div>

                <div className="compare-row">
                  <div className="compare-cell label">Mô tả</div>
                  {comparedProducts.map((product) => (
                    <div className="compare-cell" key={`${product.id}-description`}>
                      {product.description || "Chưa có mô tả."}
                    </div>
                  ))}
                </div>

                <div className="compare-row">
                  <div className="compare-cell label">Bình luận</div>
                  {comparedProducts.map((product) => {
                    const review = reviewsByProduct[product.id] || {
                      averageRating: 0,
                      total: 0,
                      items: [],
                    };

                    return (
                      <div className="compare-cell" key={`${product.id}-reviews`}>
                        <div className="compare-review-summary-box">
                          {review.total > 0 ? (
                            <>
                              <div className="compare-rating-row">
                                {renderStars(review.averageRating)}
                                <strong className="compare-rating-score">{review.averageRating}/5</strong>
                              </div>
                              <span className="compare-rating-count">({review.total} đánh giá)</span>
                            </>
                          ) : (
                            <span className="compare-no-reviews">Chưa có đánh giá</span>
                          )}
                        </div>
                        {review.items.length ? (
                          <div className="compare-review-list">
                            {renderReviewThread(review.items)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}

export default ComparePage;
