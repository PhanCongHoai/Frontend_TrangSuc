import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Footer from "./footer/Footer";
import Header from "./Header";
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
import { subscribeProductVisibilityChange } from "../utils/productSync";
import "./ProductsPage.css";

const API_BASE_URL = buildApiUrl("/api/products");
const ALL_CATEGORY_LABEL = "Tất cả";

function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 12,
  });
  const [compareItems, setCompareItems] = useState(() => getCompareItems());
  const [compareMaxItems, setCompareMaxItems] = useState(() => getCompareConfig().maxItems);
  const [replaceCandidate, setReplaceCandidate] = useState(null);
  const [compareFeedback, setCompareFeedback] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const query = useMemo(
    () => ({
      page: Number(searchParams.get("page") || 1),
      search: String(searchParams.get("search") || "").trim(),
      category: String(searchParams.get("category") || "").trim(),
      sort: String(searchParams.get("sort") || "newest").trim(),
    }),
    [searchParams]
  );

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
    setSearchInput(query.search || "");
  }, [query.search]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        params.set("page", String(Math.max(1, Number(query.page) || 1)));
        params.set("limit", "12");

        if (query.search) params.set("search", query.search);
        if (query.category) params.set("category", query.category);
        if (query.sort) params.set("sort", query.sort);
        params.set("in_stock", "1");

        const response = await fetch(`${API_BASE_URL}?${params.toString()}`);
        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Không thể tải danh sách sản phẩm.");
        }

        setProducts(Array.isArray(data.products) ? data.products : []);
        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setPagination({
          page: Number(data?.pagination?.page || 1),
          totalPages: Number(data?.pagination?.totalPages || 1),
          totalItems: Number(data?.pagination?.totalItems || 0),
          limit: Number(data?.pagination?.limit || 12),
        });
      } catch (fetchError) {
        if (fetchError instanceof TypeError) {
          setError("Không thể kết nối tới backend. Hãy kiểm tra server backend.");
        } else {
          setError(fetchError.message || "Không thể tải danh sách sản phẩm.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
    return subscribeProductVisibilityChange(() => {
      loadProducts();
    });
  }, [query.category, query.page, query.search, query.sort]);

  const selectedIds = useMemo(
    () => new Set(compareItems.map((item) => Number(item.productId))),
    [compareItems]
  );
  const activeCategoryLabel = query.category || ALL_CATEGORY_LABEL;

  const updateQuery = (nextValues) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(nextValues).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined || value === false) {
        next.delete(key);
        return;
      }
      next.set(key, String(value));
    });
    if (!("page" in nextValues)) {
      next.set("page", "1");
    }
    setSearchParams(next);
  };

  const handleCompareClick = (product) => {
    setCompareFeedback("");
    const nextCompareItem = {
      productId: Number(product.id),
      name: product.name,
      image: buildAssetUrl(product.image),
      price: product.price,
      material: product.material,
      category: product.category,
    };
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
      setCompareFeedback("Đã đủ 2 sản phẩm, hãy chọn sản phẩm cần thay.");
      return;
    }

    setCompareFeedback("Không thể thêm sản phẩm để so sánh lúc này.");
  };

  const handleReplaceSelected = (index) => {
    if (!replaceCandidate) return;

    const result = replaceCompareItemAt(index, replaceCandidate, compareMaxItems);

    if (result.status === "replaced") {
      setReplaceCandidate(null);
      setCompareFeedback("Đã thay sản phẩm trong danh sách so sánh.");
      return;
    }

    setCompareFeedback("Không thể thay sản phẩm. Vui lòng thử lại.");
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    updateQuery({
      search: searchInput.trim(),
      page: 1,
    });
  };

  return (
    <div className="products-page">
      <Header />

      <main className="products-shell">
        <section className="products-toolbar products-featured-shell">
          <div className="products-toolbar-top">
            <h1>Tất cả sản phẩm</h1>
            <p>{pagination.totalItems} sản phẩm</p>
          </div>

          <nav className="product-filter-bar" aria-label="Bộ lọc danh mục sản phẩm">
            <button
              type="button"
              className={`product-filter-link ${!query.category ? "active" : ""}`}
              onClick={() => updateQuery({ category: "", page: 1 })}
            >
              {ALL_CATEGORY_LABEL}
            </button>
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={`product-filter-link ${
                  String(activeCategoryLabel).toLowerCase() === String(item).toLowerCase()
                    ? "active"
                    : ""
                }`}
                onClick={() => updateQuery({ category: item, page: 1 })}
              >
                {item}
              </button>
            ))}
          </nav>

          <form className="products-filter-row" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm theo tên, danh mục, chất liệu..."
            />
            <button type="submit" className="products-search-button" aria-label="Tìm kiếm">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
              <span>Tìm kiếm</span>
            </button>
          </form>
        </section>

        {replaceCandidate ? (
          <section className="products-compare-replace">
            <p>
              Chọn sản phẩm cần thay bằng <strong>{replaceCandidate.name}</strong>
            </p>
            <div>
              {compareItems.map((item, index) => (
                <button
                  type="button"
                  key={item.productId}
                  onClick={() => handleReplaceSelected(index)}
                >
                  {`Thay ${item.name}`}
                </button>
              ))}
              <button type="button" onClick={() => setReplaceCandidate(null)}>
                Hủy
              </button>
            </div>
          </section>
        ) : null}

        {compareFeedback ? <p className="products-compare-feedback">{compareFeedback}</p> : null}
        {error ? <p className="products-error">{error}</p> : null}

        {loading ? (
          <div className="products-state">Đang tải sản phẩm...</div>
        ) : (
          <section className="product-grid">
            {products.map((product) => (
              <article className="products-card product-showcase-card" key={product.id}>
                <Link to={`/products/${product.id}`} className="products-image-link product-visual">
                  <img
                    className="product-visual-image"
                    src={buildAssetUrl(product.image)}
                    alt={product.name}
                  />
                </Link>
                <div className="products-card-body product-body">
                  <p className="products-category product-category">{product.category}</p>
                  <h3>{product.name}</h3>
                  <p className="products-price product-meta-row">
                    <span>{product.material}</span>
                    <strong>{product.price}</strong>
                  </p>
                  <p className="products-stock product-stock">
                    {Number(product.stockQuantity || 0) > 0
                      ? `Tồn kho: ${product.stockQuantity} sản phẩm`
                      : "Tạm hết hàng"}
                  </p>
                  <div className="products-actions product-card-actions">
                    <button
                      type="button"
                      className={`products-compare-btn product-compare-button${
                        selectedIds.has(Number(product.id)) ? " selected" : ""
                      }`}
                      onClick={() => handleCompareClick(product)}
                    >
                      {selectedIds.has(Number(product.id))
                        ? "Đã chọn"
                        : compareItems.length >= compareMaxItems
                        ? "Thay thế"
                        : "So sánh"}
                    </button>
                    <Link to={`/products/${product.id}`} className="products-view-btn product-cta">
                      Xem chi tiết
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        <section className="products-pagination">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => updateQuery({ page: Math.max(1, pagination.page - 1) })}
          >
            Trang trước
          </button>
          <span>{`Trang ${pagination.page}/${pagination.totalPages}`}</span>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              updateQuery({
                page: Math.min(pagination.totalPages, pagination.page + 1),
              })
            }
          >
            Trang sau
          </button>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default ProductsPage;
