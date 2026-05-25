import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "./Header";
import Footer from "./footer/Footer";
import {
  clearAuthSession,
  getAccessToken,
  getAuthHeaders,
  getCurrentUser,
} from "../utils/auth";
import { buildApiUrl, buildAssetUrl } from "../utils/api";
import { formatCurrency } from "../utils/pricing";
import "./OrdersPage.css";

const ORDERS_API = buildApiUrl("/api/orders");

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Không rõ thời gian";
  }

  return date.toLocaleString("vi-VN");
}

function normalizeOrderStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (["DELIVERED", "COMPLETED", "SUCCESS"].includes(normalized)) {
    return { label: "Đã giao", tone: "success" };
  }

  if (["CANCELLED", "CANCELED", "FAILED"].includes(normalized)) {
    return { label: "Đã hủy", tone: "danger" };
  }

  if (["SHIPPING", "IN_TRANSIT", "DELIVERING"].includes(normalized)) {
    return { label: "Đang giao", tone: "info" };
  }

  if (["PENDING", "WAITING_CONFIRM", "CONFIRMED", "PROCESSING"].includes(normalized)) {
    return { label: "Đang xử lý", tone: "warning" };
  }

  return { label: status || "Đã ghi nhận", tone: "neutral" };
}

function isAuthExpiredError(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("token is invalid") ||
    normalized.includes("token expired") ||
    normalized.includes("token is invalid or expired") ||
    normalized.includes("jwt expired") ||
    normalized.includes("unauthorized")
  );
}

function formatParcelWeight(value) {
  const normalizedValue = Number(value || 0);
  return normalizedValue > 0 ? `${normalizedValue} g` : "Chưa có";
}

function formatParcelDimensions(length, width, height) {
  const normalizedLength = Number(length || 0);
  const normalizedWidth = Number(width || 0);
  const normalizedHeight = Number(height || 0);

  if (normalizedLength <= 0 || normalizedWidth <= 0 || normalizedHeight <= 0) {
    return "Chưa có";
  }

  return `${normalizedLength} x ${normalizedWidth} x ${normalizedHeight} cm`;
}

function OrdersPage() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [authExpired, setAuthExpired] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setStatus("idle");
      return;
    }

    let ignore = false;

    const loadOrders = async () => {
      try {
        setStatus("loading");
        setError("");
        setAuthExpired(false);

        const response = await fetch(`${ORDERS_API}/my`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Không thể tải đơn hàng.");
        }

        if (!ignore) {
          setOrders(Array.isArray(data.data) ? data.data : []);
          setStatus("success");
        }
      } catch (fetchError) {
        if (!ignore) {
          const message = fetchError.message || "Không thể tải đơn hàng.";
          const shouldRelogin = isAuthExpiredError(message);

          if (shouldRelogin) {
            clearAuthSession();
            setCurrentUser(null);
            setAuthExpired(true);
          }

          setOrders([]);
          setStatus("error");
          setError(
            shouldRelogin
              ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xem đơn hàng."
              : message
          );
        }
      }
    };

    loadOrders();

    return () => {
      ignore = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    const accessToken = getAccessToken();

    if (!accessToken) {
      return undefined;
    }

    let ignore = false;
    const reloadOrders = async () => {
      try {
        const response = await fetch(`${ORDERS_API}/my`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Không thể tải đơn hàng.");
        }

        if (!ignore) {
          setOrders(Array.isArray(data.data) ? data.data : []);
          setStatus("success");
        }
      } catch (reloadError) {
        if (!ignore) {
          console.error("Realtime reload orders error:", reloadError);
        }
      }
    };

    const eventSource = new EventSource(
      `${ORDERS_API}/my/stream?access_token=${encodeURIComponent(accessToken)}`
    );

    eventSource.addEventListener("order", () => {
      reloadOrders();
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      ignore = true;
      eventSource.close();
    };
  }, [currentUser]);

  const orderSummary = useMemo(() => {
    if (!orders.length) {
      return {
        totalOrders: 0,
        inProgressOrders: 0,
        deliveredOrders: 0,
        totalSpent: 0,
      };
    }

    return orders.reduce(
      (acc, order) => {
        const resolvedStatus = normalizeOrderStatus(order.status);
        const total = Number(order.total || 0);

        acc.totalOrders += 1;
        acc.totalSpent += total;

        if (resolvedStatus.tone === "success") {
          acc.deliveredOrders += 1;
        } else if (resolvedStatus.tone === "warning" || resolvedStatus.tone === "info") {
          acc.inProgressOrders += 1;
        }

        return acc;
      },
      {
        totalOrders: 0,
        inProgressOrders: 0,
        deliveredOrders: 0,
        totalSpent: 0,
      }
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return orders;
    }

    return orders.filter((order) => {
      const normalizedStatus = normalizeOrderStatus(order.status);
      const fields = [
        order.orderCode,
        order.title,
        order.recipientName,
        order.recipientPhone,
        order.recipientEmail,
        order.streetAddress,
        order.wardName,
        order.districtName,
        order.provinceName,
        order.address,
        order.note,
        order.paymentLabel,
        order.paymentStatus,
        order.shippingStatus,
        order.status,
        normalizedStatus.label,
        String(order.parcelWeight || ""),
        String(order.parcelLength || ""),
        String(order.parcelWidth || ""),
        String(order.parcelHeight || ""),
        ...(Array.isArray(order.items) ? order.items.map((item) => item.name) : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return fields.includes(keyword);
    });
  }, [orders, query]);

  useEffect(() => {
    if (!expandedOrderId) {
      return;
    }

    const hasExpandedOrder = filteredOrders.some((order) => order.id === expandedOrderId);

    if (!hasExpandedOrder) {
      setExpandedOrderId(null);
    }
  }, [expandedOrderId, filteredOrders]);

  const summaryCards = [
    {
      label: "Tổng đơn",
      value: orderSummary.totalOrders,
      hint: "Tất cả đơn bạn đã đặt",
    },
    {
      label: "Đang xử lý",
      value: orderSummary.inProgressOrders,
      hint: "Đơn đang chuẩn bị hoặc vận chuyển",
    },
    {
      label: "Đã giao",
      value: orderSummary.deliveredOrders,
      hint: "Đơn đã hoàn tất",
    },
    {
      label: "Tổng chi tiêu",
      value: formatCurrency(orderSummary.totalSpent),
      hint: "Tính theo các đơn đã ghi nhận",
    },
  ];

  if (!currentUser && !authExpired) {
    return (
      <div className="orders-page">
        <Header />
        <main className="orders-shell">
          <section className="orders-empty-state">
            <p className="orders-kicker">Đơn hàng</p>
            <h1>Bạn cần đăng nhập để xem đơn hàng</h1>
            <p>Đăng nhập để theo dõi đơn đã đặt và trạng thái giao hàng của bạn.</p>
            <Link to="/login" className="orders-primary-button">
              Đăng nhập ngay
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="orders-page">
      <Header />
      <main className="orders-shell">
        {status === "success" && orders.length ? (
          <section className="orders-search-panel" aria-label="Tìm kiếm đơn hàng">
            <label htmlFor="orders-search" className="orders-kicker">
              Tìm kiếm đơn hàng
            </label>
            <div className="orders-search-row">
              <input
                id="orders-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nhập mã đơn, tên người nhận, số điện thoại hoặc tên sản phẩm..."
              />
              <button type="button" className="orders-search-button" aria-label="Tìm kiếm đơn">
                <span>Tìm kiếm</span>
              </button>
              {query ? (
                <button type="button" className="orders-clear-button" onClick={() => setQuery("")}>
                  Xóa lọc
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {status === "success" && orders.length ? (
          <section className="orders-summary-grid">
            {summaryCards.map((card) => (
              <article key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.hint}</p>
              </article>
            ))}
          </section>
        ) : null}

        {status === "loading" ? (
          <section className="orders-empty-state">
            <h2>Đang tải đơn hàng</h2>
            <p>Hệ thống đang đồng bộ dữ liệu đơn hàng từ backend.</p>
          </section>
        ) : null}

        {status === "error" ? (
          <section className="orders-empty-state">
            <h2>{authExpired ? "Phiên đăng nhập đã hết hạn" : "Không thể tải đơn hàng"}</h2>
            <p>{error}</p>
            {authExpired ? (
              <Link to="/login" className="orders-primary-button">
                Đăng nhập lại
              </Link>
            ) : null}
          </section>
        ) : null}

        {status === "success" && !orders.length ? (
          <section className="orders-empty-state">
            <h2>Chưa có đơn hàng nào</h2>
            <p>Khi bạn đặt hàng thành công, đơn mới sẽ xuất hiện tại đây.</p>
            <Link to="/" className="orders-primary-button">
              Tiếp tục mua sắm
            </Link>
          </section>
        ) : null}

        {status === "success" && orders.length && !filteredOrders.length ? (
          <section className="orders-empty-state">
            <h2>Không tìm thấy đơn phù hợp</h2>
            <p>Hãy thử từ khóa khác như mã vận đơn, tên người nhận hoặc tên sản phẩm.</p>
          </section>
        ) : null}

        {status === "success" && filteredOrders.length ? (
          <section className="orders-list">
            {filteredOrders.map((order, index) => {
              const resolvedStatus = normalizeOrderStatus(order.status);
              const items = Array.isArray(order.items) ? order.items : [];
              const previewItems = items.slice(0, 2);
              const remainingItemsCount = Math.max(0, items.length - previewItems.length);
              const isExpanded = expandedOrderId === order.id;

              return (
                <article className="orders-card" key={order.id}>
                  <div className="orders-card-preview">
                    <div className="orders-card-head">
                      <div className="orders-card-heading">
                        <span className={`orders-status status-${resolvedStatus.tone}`}>{resolvedStatus.label}</span>
                        <h2>{order.title || `Đơn hàng #${index + 1}`}</h2>
                        <p>{formatDateTime(order.createdAt)}</p>
                      </div>
                      <div className="orders-card-total">
                        <span>Tổng thanh toán</span>
                        <strong>{formatCurrency(order.total || 0)}</strong>
                      </div>
                    </div>

                    <div className="orders-preview-grid">
                      <div className="orders-preview-meta">
                        <span>Mã vận đơn</span>
                        <strong>{order.orderCode || "Chưa có"}</strong>
                      </div>
                      <div className="orders-preview-meta">
                        <span>Người nhận</span>
                        <strong>{order.recipientName || "Chưa có"}</strong>
                      </div>
                      <div className="orders-preview-meta">
                        <span>Thanh toán</span>
                        <strong>{order.paymentLabel || "Chưa xác định"}</strong>
                      </div>
                      <div className="orders-preview-meta">
                        <span>Trạng thái đơn hàng</span>
                        <strong>{resolvedStatus.label}</strong>
                      </div>
                      <div className="orders-preview-meta">
                        <span>Số sản phẩm</span>
                        <strong>{items.length}</strong>
                      </div>
                    </div>

                    <div className="orders-preview-items">
                      <strong>Sản phẩm trong đơn</strong>
                      <ul>
                        {previewItems.map((item) => (
                          <li key={`${order.id}-${item.variantId || item.productId || item.name}`}>
                            <div className="orders-preview-product">
                              <img
                                src={buildAssetUrl(item.image || "")}
                                alt={item.name}
                                loading="lazy"
                                decoding="async"
                              />
                              <span>{item.name}</span>
                            </div>
                            <div className="orders-preview-product-meta">
                              <small>{`x${item.quantity}`}</small>
                              <small>{formatCurrency(item.unitPrice || 0)}</small>
                            </div>
                          </li>
                        ))}
                        {remainingItemsCount > 0 ? (
                          <li className="orders-preview-more">
                            <span>{`+ ${remainingItemsCount} sản phẩm khác`}</span>
                          </li>
                        ) : null}
                      </ul>
                    </div>

                    <div className="orders-summary-row">
                      <span>Tạm tính: {formatCurrency(order.subtotal || 0)}</span>
                      <span>Phí ship: {formatCurrency(order.shippingFee || 0)}</span>
                      <span>Giảm giá: {formatCurrency(order.discount || 0)}</span>
                    </div>

                    <div className="orders-card-actions">
                      <button
                        type="button"
                        className="orders-primary-button orders-toggle-button"
                        onClick={() =>
                          setExpandedOrderId((currentId) => (currentId === order.id ? null : order.id))
                        }
                      >
                        {isExpanded ? "Ẩn chi tiết đơn hàng" : "Xem chi tiết đơn hàng"}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="orders-details-panel">
                      <div className="orders-meta-grid">
                        <div>
                          <span>Mã vận đơn</span>
                          <strong>{order.orderCode || "Chưa có"}</strong>
                        </div>
                        <div>
                          <span>Phương thức thanh toán</span>
                          <strong>{order.paymentLabel || "Chưa xác định"}</strong>
                        </div>
                        <div>
                          <span>Người nhận</span>
                          <strong>{order.recipientName || "Chưa có"}</strong>
                        </div>
                        <div>
                          <span>Số điện thoại</span>
                          <strong>{order.recipientPhone || "Chưa có"}</strong>
                        </div>
                        <div>
                          <span>Email</span>
                          <strong>{order.recipientEmail || "Chưa có"}</strong>
                        </div>
                        <div>
                          <span>Trạng thái thanh toán</span>
                          <strong>{order.paymentStatus || "Chưa xác định"}</strong>
                        </div>
                        <div>
                          <span>Trạng thái vận chuyển</span>
                          <strong>{order.shippingStatus || "Chưa tạo vận đơn"}</strong>
                        </div>
                        <div>
                          <span>Ngày đặt</span>
                          <strong>{formatDateTime(order.createdAt)}</strong>
                        </div>
                      </div>

                      <div className="orders-bottom-grid">
                        <div className="orders-side-stack">
                          <div className="orders-address-box">
                            <strong>Địa chỉ giao hàng</strong>
                            <div className="orders-detail-list">
                              <p>
                                <span>Địa chỉ chi tiết</span>
                                <strong>{order.streetAddress || "Chưa có"}</strong>
                              </p>
                              <p>
                                <span>Phường/Xã</span>
                                <strong>{order.wardName || "Chưa có"}</strong>
                              </p>
                              <p>
                                <span>Quận/Huyện</span>
                                <strong>{order.districtName || "Chưa có"}</strong>
                              </p>
                              <p>
                                <span>Tỉnh/Thành phố</span>
                                <strong>{order.provinceName || "Chưa có"}</strong>
                              </p>
                              <p className="orders-detail-full">
                                <span>Đầy đủ</span>
                                <strong>{order.address || "Chưa có địa chỉ"}</strong>
                              </p>
                              <p className="orders-detail-full">
                                <span>Ghi chú</span>
                                <strong>{order.note || "Không có ghi chú"}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="orders-address-box">
                            <strong>Thông số kiện hàng</strong>
                            <div className="orders-detail-list">
                              <p>
                                <span>Khối lượng</span>
                                <strong>{formatParcelWeight(order.parcelWeight)}</strong>
                              </p>
                              <p>
                                <span>Kích thước</span>
                                <strong>
                                  {formatParcelDimensions(
                                    order.parcelLength,
                                    order.parcelWidth,
                                    order.parcelHeight
                                  )}
                                </strong>
                              </p>
                              <p>
                                <span>Dài</span>
                                <strong>{order.parcelLength > 0 ? `${order.parcelLength} cm` : "Chưa có"}</strong>
                              </p>
                              <p>
                                <span>Rộng</span>
                                <strong>{order.parcelWidth > 0 ? `${order.parcelWidth} cm` : "Chưa có"}</strong>
                              </p>
                              <p>
                                <span>Cao</span>
                                <strong>{order.parcelHeight > 0 ? `${order.parcelHeight} cm` : "Chưa có"}</strong>
                              </p>
                              <p>
                                <span>Số sản phẩm trong đơn</span>
                                <strong>{items.length}</strong>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="orders-items-box">
                          <strong>Danh sách sản phẩm</strong>
                          <ul>
                            {items.map((item) => (
                              <li key={`${order.id}-${item.variantId || item.productId || item.name}`}>
                                <span>
                                  {item.name}
                                  <small>Biến thể #{item.variantId || "N/A"}</small>
                                </span>
                                <span>
                                  x{item.quantity}
                                  <small>{formatCurrency(item.unitPrice || 0)}</small>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="orders-cost-box">
                        <div>
                          <span>Tạm tính</span>
                          <strong>{formatCurrency(order.subtotal || 0)}</strong>
                        </div>
                        <div>
                          <span>Phí vận chuyển</span>
                          <strong>{formatCurrency(order.shippingFee || 0)}</strong>
                        </div>
                        <div>
                          <span>Giảm giá</span>
                          <strong>- {formatCurrency(order.discount || 0)}</strong>
                        </div>
                        <div>
                          <span>Tổng thanh toán</span>
                          <strong>{formatCurrency(order.total || 0)}</strong>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

export default OrdersPage;
