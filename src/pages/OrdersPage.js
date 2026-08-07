import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
const FALLBACK_PRODUCT_IMAGE =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ1xp79XGKoIg-gZeZiRg2G7mpp2A6kH-AWow&s";

function normalizePaymentLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (!normalized) {
    return "Chưa xác định";
  }

  if (["COD", "CASH_ON_DELIVERY"].includes(normalized)) {
    return "Thanh toán khi nhận hàng";
  }

  if (["PREPAID", "BANK_TRANSFER", "TRANSFER"].includes(normalized)) {
    return "Thanh toán trước";
  }

  return value;
}

function normalizePaymentStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (!normalized) {
    return "Chưa xác định";
  }

  if (["PAID", "SUCCESS", "COMPLETED"].includes(normalized)) {
    return "Đã thanh toán";
  }

  if (["UNPAID", "PENDING", "WAITING_PAYMENT"].includes(normalized)) {
    return "Chưa thanh toán";
  }

  if (["PROCESSING", "VERIFYING"].includes(normalized)) {
    return "Đang xử lý thanh toán";
  }

  if (["FAILED", "ERROR"].includes(normalized)) {
    return "Thanh toán thất bại";
  }

  if (["CANCELLED", "CANCELED"].includes(normalized)) {
    return "Đã hủy thanh toán";
  }

  if (["REFUNDED"].includes(normalized)) {
    return "Đã hoàn tiền";
  }

  if (["PARTIALLY_REFUNDED"].includes(normalized)) {
    return "Hoàn tiền một phần";
  }

  return status;
}

function normalizeShippingStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (!normalized) {
    return "Chưa tạo vận đơn";
  }

  if (["READY_TO_PICK", "NEW", "PICKUP_REQUESTED"].includes(normalized)) {
    return "Chờ lấy hàng";
  }

  if (["PICKING", "PICKED", "MONEY_COLLECT_PICKING"].includes(normalized)) {
    return "Đang lấy hàng";
  }

  if (["STORING", "SORTING", "TRANSPORTING", "IN_TRANSIT"].includes(normalized)) {
    return "Đang trung chuyển";
  }

  if (["DELIVERING", "SHIPPING"].includes(normalized)) {
    return "Đang giao hàng";
  }

  if (["DELIVERED", "DELIVERY_SUCCESS"].includes(normalized)) {
    return "Giao thành công";
  }

  if (["DELIVERY_FAIL", "FAILED", "EXCEPTION"].includes(normalized)) {
    return "Giao hàng thất bại";
  }

  if (["RETURN", "RETURNING"].includes(normalized)) {
    return "Đang hoàn hàng";
  }

  if (["RETURNED"].includes(normalized)) {
    return "Đã hoàn hàng";
  }

  if (["CANCELLED", "CANCELED"].includes(normalized)) {
    return "Đã hủy vận đơn";
  }

  return status;
}

function formatDateTime(value) {
  if (!value) {
    return "Chưa xác định";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Không rõ thời gian";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hourCycle: "h23",
  }).format(date);
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());

  const canCancelOrder = (order) => {
    const status = String(order.status || "").trim().toUpperCase();
    const shippingStatus = String(order.shippingStatus || "").trim().toUpperCase();
    const paymentMethod = String(order.paymentMethod || "").trim().toLowerCase();
    const paymentStatus = String(order.paymentStatus || "").trim().toUpperCase();

    if (paymentMethod === "prepaid" && paymentStatus === "PAID") {
      return false;
    }

    return (
      !["CANCELLED", "COMPLETED"].includes(status) &&
      ["PENDING", "READY_TO_PICK", ""].includes(shippingStatus)
    );
  };

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
    onConfirm: null,
  });

  const showModal = (type, title, message, onConfirm = null) => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      onConfirm,
    });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancelOrder = (orderId) => {
    showModal(
      "confirm",
      "Xác nhận hủy đơn",
      "Bạn có chắc chắn muốn hủy đơn hàng này không? Hành động này không thể hoàn tác.",
      async () => {
        try {
          const response = await fetch(`${ORDERS_API}/my/${orderId}/cancel`, {
            method: "PATCH",
            headers: getAuthHeaders(),
          });
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.message || "Không thể hủy đơn hàng.");
          }
          
          setOrders((prevOrders) =>
            prevOrders.map((ord) =>
              ord.id === orderId
                ? {
                    ...ord,
                    status: "CANCELLED",
                    shippingStatus: "CANCELLED",
                  }
                : ord
            )
          );
          
          showModal("alert", "Thành công", "Đơn hàng đã được hủy thành công.");
        } catch (err) {
          showModal("alert", "Lỗi", err.message || "Đã xảy ra lỗi khi hủy đơn hàng.");
        }
      }
    );
  };

  const handleReorder = (order) => {
    const reorderData = {
      items: (order.items || []).map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        name: item.name,
        image: item.image,
        unitPrice: item.unitPrice,
      })),
      recipient: {
        fullName: order.recipientName,
        phone: order.recipientPhone,
        email: order.recipientEmail,
        streetAddress: order.streetAddress,
        provinceName: order.provinceName,
        districtName: order.districtName,
        wardName: order.wardName,
        note: order.note,
      },
    };
    navigate("/checkout", { state: { reorderData } });
  };
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [authExpired, setAuthExpired] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedOrderPaymentInfo, setExpandedOrderPaymentInfo] = useState({});

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
    if (!expandedOrderId) return;
    const order = orders.find(o => o.id === expandedOrderId);
    if (!order) return;
    const isPrepaid = String(order.paymentMethod || "").trim().toUpperCase() === "PREPAID";
    const isUnpaid = ["UNPAID", "PENDING"].includes(String(order.paymentStatus || "").trim().toUpperCase());
    
    if (isPrepaid && isUnpaid) {
      let ignore = false;
      const fetchPaymentInfo = async () => {
        try {
          const response = await fetch(`${ORDERS_API}/${expandedOrderId}/payment-status`, {
            headers: getAuthHeaders(),
          });
          const data = await response.json();
          if (!ignore && data.success && data.data) {
            setExpandedOrderPaymentInfo(prev => ({
              ...prev,
              [expandedOrderId]: data.data.payment
            }));
            
            // Nếu đơn hàng đã được cập nhật thành PAID từ backend, reload toàn bộ đơn hàng
            if (String(data.data.payment?.status || "").trim().toUpperCase() === "PAID") {
              const ordersRes = await fetch(`${ORDERS_API}/my`, { headers: getAuthHeaders() });
              const ordersData = await ordersRes.json();
              if (ordersData.success && Array.isArray(ordersData.data)) {
                setOrders(ordersData.data);
              }
            }
          }
        } catch (err) {
          console.error("Lỗi khi tải thông tin thanh toán:", err);
        }
      };
      
      fetchPaymentInfo();
      const timer = setInterval(fetchPaymentInfo, 4000);
      return () => {
        ignore = true;
        clearInterval(timer);
      };
    }
  }, [expandedOrderId, orders]);

  useEffect(() => {
    const timer = setInterval(() => {
      setExpandedOrderPaymentInfo(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(orderId => {
          const info = next[orderId];
          if (info && info.remainingSeconds !== undefined && info.remainingSeconds > 0) {
            next[orderId] = {
              ...info,
              remainingSeconds: info.remainingSeconds - 1
            };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

    eventSource.onerror = (err) => {
      console.warn("SSE stream connection error, browser will attempt auto-reconnect", err);
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
    let result = orders;
    if (activeTab !== "ALL") {
      result = orders.filter((order) => {
        const resolved = normalizeOrderStatus(order.status);
        if (activeTab === "PENDING" && resolved.tone === "warning") return true;
        if (activeTab === "SHIPPING" && resolved.tone === "info") return true;
        if (activeTab === "DELIVERED" && resolved.tone === "success") return true;
        if (activeTab === "CANCELLED" && resolved.tone === "danger") return true;
        return false;
      });
    }

    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return result;
    }

    return result.filter((order) => {
      const normalizedStatus = normalizeOrderStatus(order.status);
      const normalizedPaymentLabel = normalizePaymentLabel(
        order.paymentLabel || order.paymentMethod
      );
      const normalizedPaymentStatus = normalizePaymentStatus(order.paymentStatus);
      const normalizedShippingStatus = normalizeShippingStatus(order.shippingStatus);
      const fields = [
        order.orderCode,
        order.shippingCode,
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
        normalizedPaymentLabel,
        normalizedPaymentStatus,
        normalizedShippingStatus,
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
  }, [orders, query, activeTab]);

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

        {status === "success" && orders.length ? (
          <div className="orders-tabs">
            <button
              type="button"
              className={`orders-tab-btn ${activeTab === "ALL" ? "active" : ""}`}
              onClick={() => { setActiveTab("ALL"); setExpandedOrderId(null); }}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`orders-tab-btn ${activeTab === "PENDING" ? "active" : ""}`}
              onClick={() => { setActiveTab("PENDING"); setExpandedOrderId(null); }}
            >
              Đang xử lý
            </button>
            <button
              type="button"
              className={`orders-tab-btn ${activeTab === "SHIPPING" ? "active" : ""}`}
              onClick={() => { setActiveTab("SHIPPING"); setExpandedOrderId(null); }}
            >
              Đang giao
            </button>
            <button
              type="button"
              className={`orders-tab-btn ${activeTab === "DELIVERED" ? "active" : ""}`}
              onClick={() => { setActiveTab("DELIVERED"); setExpandedOrderId(null); }}
            >
              Đã giao
            </button>
            <button
              type="button"
              className={`orders-tab-btn ${activeTab === "CANCELLED" ? "active" : ""}`}
              onClick={() => { setActiveTab("CANCELLED"); setExpandedOrderId(null); }}
            >
              Đã hủy
            </button>
          </div>
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
          <section className="orders-table-wrapper">
            <div className="orders-table-header">
              <div className="orders-th">Mã đơn & Ngày đặt</div>
              <div className="orders-th">Sản phẩm</div>
              <div className="orders-th">Tổng thanh toán</div>
              <div className="orders-th">Trạng thái</div>
              <div className="orders-th">Hành động</div>
            </div>
            <div className="orders-table-body">
              {filteredOrders.map((order, index) => {
                const resolvedStatus = normalizeOrderStatus(order.status);
                const isDelivered = ["DELIVERED", "COMPLETED", "SUCCESS"].includes(String(order.status || "").trim().toUpperCase());
                const resolvedPaymentLabel = normalizePaymentLabel(
                  order.paymentLabel || order.paymentMethod
                );
                const resolvedPaymentStatus = normalizePaymentStatus(order.paymentStatus);
                const resolvedShippingStatus = normalizeShippingStatus(order.shippingStatus);
                const items = Array.isArray(order.items) ? order.items : [];
                const firstItem = items[0] || {};
                const remainingCount = items.length - 1;
                const isExpanded = expandedOrderId === order.id;

                return (
                  <div 
                    className={`orders-row-item ${isExpanded ? "expanded" : ""}`} 
                    key={order.id}
                  >
                    <div 
                      className="orders-row-summary"
                      onClick={() => setExpandedOrderId(currentId => currentId === order.id ? null : order.id)}
                    >
                      <div className="orders-td orders-td-code">
                        <strong className="order-code-text">{order.orderCode || `#DH-${order.id}`}</strong>
                        <span className="order-date-text">Ngày đặt: {formatDateTime(order.createdAt)}</span>
                      </div>
                      <div className="orders-td orders-td-product">
                        {firstItem.name ? (
                          <div className="orders-row-product-preview">
                            <img
                              src={buildAssetUrl(firstItem.image || FALLBACK_PRODUCT_IMAGE)}
                              alt={firstItem.name}
                              className="order-row-product-img"
                              loading="lazy"
                            />
                            <div className="order-row-product-info">
                              <span className="order-row-product-name">{firstItem.name}</span>
                              {remainingCount > 0 && (
                                <span className="order-row-product-more">và {remainingCount} sản phẩm khác</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="order-no-items">Không có sản phẩm</span>
                        )}
                      </div>
                      <div className="orders-td orders-td-price">
                        <strong className="order-price-text">{formatCurrency(order.total || 0)}</strong>
                      </div>
                      <div className="orders-td orders-td-status">
                        <span className={`orders-status-badge status-${resolvedStatus.tone}`}>
                          {resolvedStatus.label}
                        </span>
                      </div>
                      <div className="orders-td orders-td-action">
                        <button type="button" className="order-expand-toggle-btn">
                          {isExpanded ? "Thu gọn ▲" : "Chi tiết ▼"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="orders-row-details">
                        <div className="orders-details-grid">
                          {/* Column 1: Recipient Info */}
                          <div className="orders-detail-card">
                            <h3>📍 Thông tin nhận hàng</h3>
                            <div className="orders-detail-info-list">
                              <p>
                                <span>Người nhận:</span>
                                <strong>{order.recipientName || "Chưa có"}</strong>
                              </p>
                              <p>
                                <span>Số điện thoại:</span>
                                <strong>{order.recipientPhone || "Chưa có"}</strong>
                              </p>
                              <p>
                                <span>Email:</span>
                                <strong>{order.recipientEmail || "Chưa có"}</strong>
                              </p>
                              <p className="orders-detail-full-width">
                                <span>Địa chỉ giao hàng:</span>
                                <strong>{order.address || "Chưa có"}</strong>
                              </p>
                              <p className="orders-detail-full-width">
                                <span>Ghi chú:</span>
                                <strong>{order.note || "Không có ghi chú"}</strong>
                              </p>
                            </div>
                          </div>

                          {/* Column 2: Shipping Info */}
                          <div className="orders-detail-card">
                            <h3>🚚 Thông tin vận chuyển</h3>
                            <div className="orders-detail-info-list">
                              <p>
                                <span>Trạng thái:</span>
                                <strong>{resolvedShippingStatus}</strong>
                              </p>
                              <p>
                                <span>Mã vận đơn:</span>
                                <strong>{order.shippingCode || "Chưa có"}</strong>
                              </p>
                              <p>
                                <span>Khối lượng:</span>
                                <strong>{formatParcelWeight(order.parcelWeight)}</strong>
                              </p>
                              <p className="orders-detail-full-width">
                                <span>Kích thước (D x R x C):</span>
                                <strong>
                                  {formatParcelDimensions(
                                    order.parcelLength,
                                    order.parcelWidth,
                                    order.parcelHeight
                                  )}
                                </strong>
                              </p>
                            </div>
                          </div>

                          {/* Column 3: Payment Info */}
                          <div className="orders-detail-card">
                            <h3>💳 Thông tin thanh toán</h3>
                            <div className="orders-detail-info-list">
                              <p>
                                <span>Phương thức:</span>
                                <strong>{resolvedPaymentLabel}</strong>
                              </p>
                              <p>
                                <span>Trạng thái:</span>
                                <strong>{resolvedPaymentStatus}</strong>
                              </p>
                              <p className="orders-detail-full-width">
                                <span>Ngày đặt hàng:</span>
                                <strong>{formatDateTime(order.createdAt)}</strong>
                              </p>
                              <p className="orders-detail-full-width">
                                <span>Ngày thanh toán:</span>
                                <strong>{order.paidAt ? formatDateTime(order.paidAt) : "Chưa thanh toán"}</strong>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* QR Code and Countdown Timer Block */}
                        {(() => {
                          const isPrepaid = String(order.paymentMethod || "").trim().toUpperCase() === "PREPAID";
                          const isUnpaid = ["UNPAID", "PENDING"].includes(String(order.paymentStatus || "").trim().toUpperCase());
                          const info = expandedOrderPaymentInfo[order.id];
                          if (!isPrepaid || !isUnpaid || !info) return null;

                          return (
                            <div className="orders-payment-qr-block" style={{
                              background: "rgba(255, 255, 255, 0.02)",
                              border: "1px dashed rgba(212, 175, 55, 0.4)",
                              borderRadius: "12px",
                              padding: "20px",
                              marginBottom: "20px",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "15px",
                              textAlign: "center"
                            }}>
                              <h4 style={{ color: "#d4af37", margin: 0, fontSize: "16px", fontWeight: "700" }}>
                                Đơn hàng đang chờ thanh toán chuyển khoản trước
                              </h4>
                              
                              {info.remainingSeconds !== undefined && (
                                <div style={{
                                  fontSize: "14px",
                                  fontWeight: "600",
                                  color: info.remainingSeconds > 0 ? "#d4af37" : "#e05252",
                                  background: info.remainingSeconds > 0 ? "rgba(212, 175, 55, 0.1)" : "rgba(224, 82, 82, 0.1)",
                                  padding: "8px 16px",
                                  borderRadius: "20px"
                                }}>
                                  {info.remainingSeconds > 0 ? (
                                    <span>Thời gian còn lại để thanh toán: {formatTime(info.remainingSeconds)}</span>
                                  ) : (
                                    <span>Đơn hàng đã hết hạn thanh toán (Quá 3 phút) và sẽ tự hủy.</span>
                                  )}
                                </div>
                              )}

                              {info.remainingSeconds > 0 && info.qrCodeUrl ? (
                                <>
                                  <div style={{
                                    background: "#fff",
                                    padding: "10px",
                                    borderRadius: "10px",
                                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                                  }}>
                                    <img 
                                      src={info.qrCodeUrl} 
                                      alt="QR thanh toán chuyển khoản"
                                      style={{ width: "180px", height: "180px", display: "block" }}
                                    />
                                  </div>
                                  <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr",
                                    gap: "8px",
                                    maxWidth: "400px",
                                    width: "100%",
                                    fontSize: "13px",
                                    background: "rgba(255,255,255,0.03)",
                                    padding: "15px",
                                    borderRadius: "8px",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                    textAlign: "left"
                                  }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#aaa" }}>Ngân hàng:</span>
                                      <strong>{info.bankName || info.bankCode || "VPBank"}</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#aaa" }}>Số tài khoản ảo:</span>
                                      <strong>{info.accountNumber || "N/A"}</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#aaa" }}>Chủ tài khoản:</span>
                                      <strong>{info.accountHolderName || "N/A"}</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#aaa" }}>Số tiền:</span>
                                      <strong style={{ color: "#d4af37" }}>{formatCurrency(info.amount || order.total || 0)}</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span style={{ color: "#aaa" }}>Nội dung chuyển khoản:</span>
                                      <strong>{info.transferContent || "N/A"}</strong>
                                    </div>
                                  </div>
                                  <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>
                                    Quét mã QR bằng ứng dụng ngân hàng của bạn. Hệ thống sẽ tự động xác nhận đơn hàng sau khi bạn chuyển khoản thành công.
                                  </p>
                                </>
                              ) : null}
                            </div>
                          );
                        })()}

                        {/* Order Items Table */}
                        <div className="orders-details-products-box">
                          <h3>Danh sách sản phẩm trong đơn</h3>
                          <div className="orders-details-products-list">
                            {items.map((item) => (
                              <div 
                                className="orders-details-product-row" 
                                key={`${order.id}-${item.variantId || item.productId || item.name}`}
                              >
                                <div className="orders-details-product-main">
                                  <img
                                    src={buildAssetUrl(item.image || FALLBACK_PRODUCT_IMAGE)}
                                    alt={item.name}
                                    className="orders-details-product-img"
                                    loading="lazy"
                                  />
                                  <div className="orders-details-product-title-box">
                                    <strong className="orders-details-product-name">{item.name}</strong>
                                    <small className="orders-details-product-variant">Mã biến thể: #{item.variantId || "N/A"}</small>
                                  </div>
                                </div>
                                <div className="orders-details-product-quantity-price">
                                  <span>{formatCurrency(item.unitPrice || 0)}</span>
                                  <span>x{item.quantity}</span>
                                  <strong>{formatCurrency((item.unitPrice || 0) * item.quantity)}</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Cost breakdown */}
                        <div className="orders-details-cost-breakdown">
                          <div className="orders-cost-line">
                            <span>Tạm tính:</span>
                            <span>{formatCurrency(order.subtotal || 0)}</span>
                          </div>
                          <div className="orders-cost-line">
                            <span>Phí vận chuyển:</span>
                            <span>{formatCurrency(order.shippingFee || 0)}</span>
                          </div>
                          <div className="orders-cost-line">
                            <span>Giảm giá:</span>
                            <span>- {formatCurrency(order.discount || 0)}</span>
                          </div>
                          <div className="orders-cost-line total">
                            <span>Tổng thanh toán:</span>
                            <strong>{formatCurrency(order.total || 0)}</strong>
                          </div>
                        </div>

                        {/* Actions bar for cancelling or reordering */}
                        <div className="orders-details-actions-bar">
                          {canCancelOrder(order) && (
                            <button
                              type="button"
                              className="orders-action-btn btn-cancel"
                              onClick={() => handleCancelOrder(order.id)}
                            >
                              Hủy đơn hàng
                            </button>
                          )}
                          {isDelivered && (
                            <button
                              type="button"
                              className="orders-action-btn btn-reorder"
                              onClick={() => handleReorder(order)}
                            >
                              Mua lại
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
      <Footer />

      {modalConfig.isOpen && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-box">
            <div className="custom-modal-header">
              <h3>{modalConfig.title}</h3>
              <button type="button" className="custom-modal-close-btn" onClick={closeModal}>&times;</button>
            </div>
            <div className="custom-modal-body">
              <p>{modalConfig.message}</p>
            </div>
            <div className="custom-modal-footer">
              {modalConfig.type === "confirm" ? (
                <>
                  <button
                    type="button"
                    className="custom-modal-btn btn-secondary"
                    onClick={closeModal}
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    className="custom-modal-btn btn-danger"
                    onClick={() => {
                      if (modalConfig.onConfirm) modalConfig.onConfirm();
                      closeModal();
                    }}
                  >
                    Xác nhận hủy
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="custom-modal-btn btn-primary"
                  onClick={closeModal}
                >
                  Đồng ý
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersPage;
