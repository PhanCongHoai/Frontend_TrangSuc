import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addCompareItem,
  fetchCompareConfig,
  getCompareConfig,
  getCompareItems,
  removeCompareItem,
  replaceCompareItemAt,
  subscribeCompareChange,
} from "../../../utils/compare";
import { buildAssetUrl } from "../../../utils/api";

const ALL_LABEL = "Tất cả";
const FILTER_LABEL = "Bộ lọc sản phẩm";
const IN_STOCK_TEXT = "Tồn kho:";
const OUT_OF_STOCK_TEXT = "Tạm hết hàng";
const VIEW_DETAIL_TEXT = "Xem chi tiết";
const EMPTY_TITLE = "Chưa có sản phẩm trong danh mục này";
const EMPTY_COPY =
  'Thử chọn danh mục con hoặc quay lại mục "Tất cả" để xem toàn bộ mẫu.';

const PRODUCT_PAGE_SIZE = 10;
const LOAD_MORE_TEXT = "Xem thêm";

function FeaturedProductsSection({ collections, products }) {
  const navigationItems = useMemo(() => {
    const parentItems = collections.map((item) => ({
      key: String(item.id || item.title),
      label: item.title,
      children: (item.children || []).map((child) => ({
        key: `${item.id || item.title}-${child.id || child.name}`,
        label: child.name,
        parentLabel: item.title,
      })),
    }));

    if (parentItems.length) {
      return parentItems;
    }

    const fallbackParents = [...new Set(products.map((product) => product.category))];
    return fallbackParents.map((category) => ({
      key: category,
      label: category,
      children: [],
    }));
  }, [collections, products]);

  const [activeFilter, setActiveFilter] = useState({
    label: ALL_LABEL,
    parentLabel: null,
  });
  const [compareItems, setCompareItems] = useState(() => getCompareItems());
  const [compareMaxItems, setCompareMaxItems] = useState(() => getCompareConfig().maxItems);
  const [replaceCandidate, setReplaceCandidate] = useState(null);
  const [compareFeedback, setCompareFeedback] = useState("");
  const [visibleProductCount, setVisibleProductCount] = useState(PRODUCT_PAGE_SIZE);

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

  useEffect(() => {
    const hasActiveFilter =
      activeFilter.label === ALL_LABEL ||
      navigationItems.some(
        (item) =>
          item.label === activeFilter.label ||
          item.label === activeFilter.parentLabel ||
          item.children.some((child) => child.label === activeFilter.label)
      );

    if (!hasActiveFilter) {
      setActiveFilter({ label: ALL_LABEL, parentLabel: null });
    }
  }, [activeFilter, navigationItems]);

  useEffect(() => {
    setVisibleProductCount(PRODUCT_PAGE_SIZE);
  }, [activeFilter.label, activeFilter.parentLabel]);

  const activeParentItem = useMemo(() => {
    if (activeFilter.label === ALL_LABEL) {
      return null;
    }

    return (
      navigationItems.find((item) => item.label === activeFilter.parentLabel) ||
      navigationItems.find((item) => item.label === activeFilter.label) ||
      null
    );
  }, [activeFilter, navigationItems]);

  const filteredProducts = useMemo(() => {
    const inStockProducts = products.filter(
      (product) => Number(product.stockQuantity || 0) > 0
    );

    if (activeFilter.label === ALL_LABEL) {
      return inStockProducts;
    }

    const selectedParent =
      navigationItems.find((item) => item.label === activeFilter.parentLabel) ||
      navigationItems.find((item) => item.label === activeFilter.label);

    const allowedLabels =
      selectedParent && activeFilter.label === selectedParent.label
        ? [selectedParent.label, ...selectedParent.children.map((child) => child.label)]
        : [activeFilter.label];

    return inStockProducts.filter((product) =>
      allowedLabels.includes(product.category)
    );
  }, [activeFilter, navigationItems, products]);

  const selectedIds = useMemo(
    () => new Set(compareItems.map((item) => Number(item.productId))),
    [compareItems]
  );
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductCount),
    [filteredProducts, visibleProductCount]
  );
  const hasMoreProducts = filteredProducts.length > visibleProducts.length;

  const buildComparePayload = (product) => ({
    productId: Number(product.id),
    name: product.name,
    image: buildAssetUrl(product.image),
    price: product.price,
    material: product.material,
    category: product.category,
  });

  const handleCompareClick = (event, product) => {
    event.preventDefault();
    event.stopPropagation();
    setCompareFeedback("");

    const nextCompareItem = buildComparePayload(product);
    const isAlreadySelected = selectedIds.has(nextCompareItem.productId);

    if (isAlreadySelected) {
      removeCompareItem(nextCompareItem.productId);
      setReplaceCandidate(null);
      setCompareFeedback("Đã bỏ sản phẩm khỏi danh sách so sánh.");
      return;
    }

    const result = addCompareItem(nextCompareItem, compareMaxItems);

    if (result.status === "added") {
      setCompareFeedback("Đã thêm sản phẩm vào danh sách so sánh.");
      return;
    }

    if (result.status === "requires_replace") {
      setReplaceCandidate(nextCompareItem);
      setCompareFeedback(
        "Danh sách so sánh đã đủ 2 sản phẩm. Chọn sản phẩm cần thay bên dưới."
      );
      return;
    }

    setCompareFeedback("Không thể thêm sản phẩm để so sánh lúc này.");
  };

  const handleReplaceSelected = (index) => {
    if (!replaceCandidate) {
      return;
    }

    const result = replaceCompareItemAt(index, replaceCandidate, compareMaxItems);

    if (result.status === "replaced") {
      setCompareFeedback("Đã thay sản phẩm trong danh sách so sánh.");
      setReplaceCandidate(null);
      return;
    }

    setCompareFeedback("Không thể thay sản phẩm. Vui lòng thử lại.");
  };

  const resolveCompareButtonLabel = (productId) => {
    if (selectedIds.has(Number(productId))) {
      return "Đã chọn";
    }

    if (compareItems.length >= compareMaxItems) {
      return "Thay thế";
    }

    return "So sánh";
  };

  return (
    <section className="featured-products" id="featured-products">
      <nav
        className="product-filter-bar"
        aria-label={FILTER_LABEL}
        style={{
          "--filter-count": navigationItems.length + 1,
          "--mobile-filter-cols": Math.ceil((navigationItems.length + 1) / 2),
        }}
      >
        <button
          type="button"
          className={`product-filter-link ${activeFilter.label === ALL_LABEL ? "active" : ""}`}
          onClick={() => setActiveFilter({ label: ALL_LABEL, parentLabel: null })}
        >
          {ALL_LABEL}
        </button>

        {navigationItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`product-filter-link ${
              activeFilter.label === item.label || activeFilter.parentLabel === item.label
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveFilter({
                label: item.label,
                parentLabel: item.label,
              })
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      {activeParentItem?.children.length ? (
        <div
          className="product-subfilter-bar"
          aria-label={`Danh mục con của ${activeParentItem.label}`}
        >
          <button
            type="button"
            className={`product-subfilter-link ${
              activeFilter.label === activeParentItem.label ? "active" : ""
            }`}
            onClick={() =>
              setActiveFilter({
                label: activeParentItem.label,
                parentLabel: activeParentItem.label,
              })
            }
          >
            {`Tất cả trong ${activeParentItem.label}`}
          </button>

          {activeParentItem.children.map((child) => (
            <button
              key={child.key}
              type="button"
              className={`product-subfilter-link ${activeFilter.label === child.label ? "active" : ""}`}
              onClick={() =>
                setActiveFilter({
                  label: child.label,
                  parentLabel: child.parentLabel,
                })
              }
            >
              {child.label}
            </button>
          ))}
        </div>
      ) : null}

      {replaceCandidate ? (
        <div className="compare-replace-panel">
          <p>
            Chọn sản phẩm cần thay bằng <strong>{replaceCandidate.name}</strong>
          </p>
          <div className="compare-replace-actions">
            {compareItems.map((item, index) => (
              <button
                type="button"
                key={item.productId}
                className="compare-replace-button"
                onClick={() => handleReplaceSelected(index)}
              >
                {`Thay ${item.name}`}
              </button>
            ))}
            <button
              type="button"
              className="compare-replace-cancel"
              onClick={() => setReplaceCandidate(null)}
            >
              Hủy
            </button>
          </div>
        </div>
      ) : null}

      {compareFeedback ? <p className="compare-feedback">{compareFeedback}</p> : null}

      <div className="product-grid">
        {filteredProducts.length ? (
          visibleProducts.map((product) => (
            <Link
              to={`/products/${product.id}`}
              className="product-showcase-card"
              key={product.id}
            >
              <div className="product-visual">
                {product.image ? (
                  <img
                    className="product-visual-image"
                    src={buildAssetUrl(product.image)}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="product-visual-image product-visual-image-empty">
                    Không có ảnh
                  </div>
                )}
              </div>

              <div className="product-body">
                <p className="product-category">{product.category}</p>
                <h3>{product.name}</h3>
                {product.description ? (
                  <p className="product-description">{product.description}</p>
                ) : null}

                <div className="product-meta-row">
                  <span>{product.material}</span>
                  <strong>{product.price}</strong>
                </div>

                <p className="product-stock">
                  {IN_STOCK_TEXT}{" "}
                  <strong>
                    {product.stockQuantity > 0
                      ? `${product.stockQuantity} sản phẩm`
                      : OUT_OF_STOCK_TEXT}
                  </strong>
                </p>

                <div className="product-card-actions">
                  <button
                    type="button"
                    className={`product-compare-button${
                      selectedIds.has(Number(product.id)) ? " selected" : ""
                    }`}
                    onClick={(event) => handleCompareClick(event, product)}
                  >
                    {resolveCompareButtonLabel(product.id)}
                  </button>
                  <span className="product-cta">{VIEW_DETAIL_TEXT}</span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="product-empty-state">
            <h3>{EMPTY_TITLE}</h3>
            <p>{EMPTY_COPY}</p>
          </div>
        )}
      </div>

      {(hasMoreProducts || visibleProductCount > PRODUCT_PAGE_SIZE) ? (
        <div className="product-load-more" style={{ display: "flex", gap: "14px", justifyContent: "center" }}>
          {hasMoreProducts && (
            <button
              type="button"
              onClick={() =>
                setVisibleProductCount((currentCount) => currentCount + PRODUCT_PAGE_SIZE)
              }
            >
              {LOAD_MORE_TEXT}
            </button>
          )}
          {visibleProductCount > PRODUCT_PAGE_SIZE && (
            <button
              type="button"
              className="product-collapse-button"
              onClick={() => {
                setVisibleProductCount(PRODUCT_PAGE_SIZE);
                // Scroll back to the top of featured products section smoothly
                const element = document.getElementById("featured-products");
                element?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Thu gọn
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default FeaturedProductsSection;
