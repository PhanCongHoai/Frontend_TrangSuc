import { useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";
import { formatCurrency } from "../../../utils/pricing";
import "./ShipperSimulatorPage.css";

const ORDERS_API = buildApiUrl("/api/orders/admin/list");
const STATUS_API = buildApiUrl("/api/orders/admin");

function ShipperSimulatorPage() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeTab, setActiveTab] = useState("pending_pickup"); // pending_pickup, shipping, history
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  const loadOrders = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");

      const response = await fetch(ORDERS_API, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể tải danh sách đơn hàng.");
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setStatus("success");
    } catch (fetchError) {
      setOrders([]);
      setStatus("error");
      setError(fetchError.message || "Không thể tải danh sách đơn hàng.");
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Realtime updates using SSE
  useEffect(() => {
    const accessToken = getAccessToken();
    if (!accessToken) return undefined;

    const eventSource = new EventSource(
      `${buildApiUrl("/api/orders/admin/stream")}?access_token=${encodeURIComponent(
        accessToken
      )}`
    );

    eventSource.addEventListener("order", () => {
      loadOrders();
    });

    eventSource.onerror = (err) => {
      console.warn("SSE stream connection error, browser will attempt auto-reconnect", err);
    };

    return () => {
      eventSource.close();
    };
  }, [loadOrders]);

  // Status handlers
  const handleUpdateStatus = async (orderId, nextStatus, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    // Confirms for actions
    let confirmMsg = "";
    if (nextStatus === "SHIPPING") {
      confirmMsg = "Xác nhận bạn đã lấy hàng và bắt đầu giao đơn này?";
    } else if (nextStatus === "COMPLETED") {
      confirmMsg = "Xác nhận giao hàng thành công?";
    } else if (nextStatus === "CANCELLED") {
      confirmMsg = "Xác nhận giao hàng thất bại (Hủy đơn hàng)?";
    }

    if (confirmMsg && !window.confirm(confirmMsg)) {
      return;
    }

    try {
      setUpdatingOrderId(orderId);
      setActionFeedback(null);

      const response = await fetch(`${STATUS_API}/${orderId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể cập nhật trạng thái.");
      }

      setActionFeedback({
        type: "success",
        message: `Đã cập nhật trạng thái đơn hàng thành công.`,
      });

      // Clear details modal if active order was updated
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status: nextStatus, statusLabel: data.order?.statusLabel || nextStatus } : null);
      }

      await loadOrders();
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: err.message || "Cập nhật trạng thái thất bại.",
      });
    } finally {
      setUpdatingOrderId(null);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  // Filter orders by search keyword & active tab
  const filteredOrders = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    
    return orders.filter((order) => {
      // Tab matching
      let matchesTab = false;
      if (activeTab === "pending_pickup") {
        matchesTab = order.status === "PROCESSING";
      } else if (activeTab === "shipping") {
        matchesTab = order.status === "SHIPPING";
      } else if (activeTab === "completed") {
        matchesTab = order.status === "COMPLETED";
      } else if (activeTab === "cancelled") {
        matchesTab = order.status === "CANCELLED";
      }

      // Keyword matching
      const matchesKeyword =
        !keyword ||
        String(order.code || "").toLowerCase().includes(keyword) ||
        String(order.customer || "").toLowerCase().includes(keyword) ||
        String(order.phone || "").toLowerCase().includes(keyword) ||
        String(order.address || "").toLowerCase().includes(keyword);

      return matchesTab && matchesKeyword;
    });
  }, [orders, searchKeyword, activeTab]);

  // Statistics calculation
  const stats = useMemo(() => {
    const counts = {
      pending_pickup: 0,
      shipping: 0,
      completed: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      if (o.status === "PROCESSING") counts.pending_pickup++;
      else if (o.status === "SHIPPING") counts.shipping++;
      else if (o.status === "COMPLETED") counts.completed++;
      else if (o.status === "CANCELLED") counts.cancelled++;
    });
    return counts;
  }, [orders]);

  const isCod = (order) => {
    const method = String(order.paymentMethod || "").trim().toUpperCase();
    return method === "COD";
  };

  return (
    <section className="panel-page shipper-simulator-container">
      <div className="page-head shipper-header-layout">
        <div>
          <h1>Simulate Shipper Panel</h1>
          <p>Bảng điều khiển giả lập dành cho Shipper - Tương tác dữ liệu thời gian thực</p>
        </div>
        <div className="shipper-live-indicator">
          <span className="live-dot"></span>
          SSE Realtime Live
        </div>
      </div>

      {/* Stats Section */}
      <div className="shipper-stats-grid">
        <div className="shipper-stat-card border-pending">
          <span>Chờ lấy hàng</span>
          <strong className="text-pending">{stats.pending_pickup}</strong>
        </div>
        <div className="shipper-stat-card border-shipping">
          <span>Đang giao</span>
          <strong className="text-shipping">{stats.shipping}</strong>
        </div>
        <div className="shipper-stat-card border-completed">
          <span>Giao thành công</span>
          <strong className="text-completed">{stats.completed}</strong>
        </div>
        <div className="shipper-stat-card border-cancelled">
          <span>Đơn thất bại/Hủy</span>
          <strong className="text-cancelled">{stats.cancelled}</strong>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shipper-toolbar">
        <div className="shipper-search-wrapper">
          <input
            type="text"
            placeholder="Tìm theo mã đơn, tên khách hàng, số điện thoại..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="shipper-search-input"
          />
          {searchKeyword && (
            <button onClick={() => setSearchKeyword("")} className="shipper-clear-search">
              Clear
            </button>
          )}
        </div>
        <button onClick={loadOrders} className="shipper-refresh-btn" disabled={status === "loading"}>
          {status === "loading" ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {/* Feedback Messages */}
      {actionFeedback && (
        <div className={`shipper-alert ${actionFeedback.type === "success" ? "success" : "error"}`}>
          {actionFeedback.message}
        </div>
      )}

      {/* Tabs */}
      <div className="shipper-tabs">
        <button
          className={`shipper-tab ${activeTab === "pending_pickup" ? "active" : ""}`}
          onClick={() => setActiveTab("pending_pickup")}
        >
          Chờ lấy hàng ({stats.pending_pickup})
        </button>
        <button
          className={`shipper-tab ${activeTab === "shipping" ? "active" : ""}`}
          onClick={() => setActiveTab("shipping")}
        >
          Đang giao hàng ({stats.shipping})
        </button>
        <button
          className={`shipper-tab ${activeTab === "completed" ? "active" : ""}`}
          onClick={() => setActiveTab("completed")}
        >
          Giao thành công ({stats.completed})
        </button>
        <button
          className={`shipper-tab ${activeTab === "cancelled" ? "active" : ""}`}
          onClick={() => setActiveTab("cancelled")}
        >
          Đơn thất bại/Hủy ({stats.cancelled})
        </button>
      </div>

      {/* Orders List Container */}
      <div className="shipper-orders-layout">
        {status === "loading" && orders.length === 0 ? (
          <div className="shipper-info-box">Đang tải danh sách đơn hàng...</div>
        ) : error ? (
          <div className="shipper-info-box error-box">Lỗi: {error}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="shipper-empty-state">Không tìm thấy đơn hàng nào phù hợp.</div>
        ) : (
          <div className="shipper-cards-grid">
            {filteredOrders.map((order) => {
              const cod = isCod(order);
              return (
                <div
                  key={order.id}
                  className="shipper-order-card"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="card-header">
                    <span className="order-code">{order.code}</span>
                    <span className="order-date">{order.createdAtLabel}</span>
                  </div>

                  <div className="card-body">
                    <p className="customer-info">
                      <strong>Khách hàng:</strong> {order.customer} 
                      {order.phone && (
                        <a 
                          href={`tel:${order.phone}`} 
                          className="shipper-phone-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          📞 {order.phone}
                        </a>
                      )}
                    </p>
                    <p className="address-info">
                      <strong>Địa chỉ:</strong> {order.address}
                    </p>
                    {order.note && (
                      <p className="note-info">
                        <strong>Ghi chú:</strong> {order.note}
                      </p>
                    )}
                    <div className="payment-tag-wrapper">
                      {cod ? (
                        <span className="payment-badge cod">
                          💵 THU HỘ COD: {formatCurrency(order.total)}
                        </span>
                      ) : (
                        <span className="payment-badge prepaid">
                          💳 ĐÃ THANH TOÁN TRƯỚC (Thu 0đ)
                        </span>
                      )}
                      <span className="payment-method-label">{order.paymentLabel}</span>
                    </div>
                  </div>

                  <div className="card-footer">
                    <div className="status-label-wrap">
                      Trạng thái: <span className={`status-pill pill-${String(order.status).toLowerCase()}`}>{order.statusLabel}</span>
                    </div>
                    <div className="action-buttons-wrap">
                      {order.status === "PROCESSING" && (
                        <button
                          className="shipper-action-btn btn-pickup"
                          disabled={updatingOrderId === order.id}
                          onClick={(e) => handleUpdateStatus(order.id, "SHIPPING", e)}
                        >
                          {updatingOrderId === order.id ? "Đang xử lý..." : "Lấy hàng & Giao"}
                        </button>
                      )}
                      {order.status === "SHIPPING" && (
                        <>
                          <button
                            className="shipper-action-btn btn-success"
                            disabled={updatingOrderId === order.id}
                            onClick={(e) => handleUpdateStatus(order.id, "COMPLETED", e)}
                          >
                            {updatingOrderId === order.id ? "..." : "Thành công"}
                          </button>
                          <button
                            className="shipper-action-btn btn-danger"
                            disabled={updatingOrderId === order.id}
                            onClick={(e) => handleUpdateStatus(order.id, "CANCELLED", e)}
                          >
                            {updatingOrderId === order.id ? "..." : "Thất bại"}
                          </button>
                        </>
                      )}
                      {(order.status === "COMPLETED" || order.status === "CANCELLED") && (
                        <span className="history-done-check">
                          {order.status === "COMPLETED" ? "✅ Giao thành công" : "❌ Đã hủy/Giao lỗi"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedOrder && (
        <div className="shipper-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="shipper-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi tiết đơn hàng {selectedOrder.code}</h2>
              <button className="modal-close-btn" onClick={() => setSelectedOrder(null)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-grid-2">
                <div>
                  <h3>Thông tin giao nhận</h3>
                  <table className="shipper-details-table">
                    <tbody>
                      <tr>
                        <td>Người nhận:</td>
                        <td><strong>{selectedOrder.customer}</strong></td>
                      </tr>
                      <tr>
                        <td>Số điện thoại:</td>
                        <td>{selectedOrder.phone}</td>
                      </tr>
                      <tr>
                        <td>Địa chỉ giao:</td>
                        <td>{selectedOrder.address}</td>
                      </tr>
                      <tr>
                        <td>Ghi chú:</td>
                        <td>{selectedOrder.note || <em className="muted">Không có ghi chú</em>}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3>Thông tin thanh toán</h3>
                  <table className="shipper-details-table">
                    <tbody>
                      <tr>
                        <td>Phương thức:</td>
                        <td>{selectedOrder.paymentLabel}</td>
                      </tr>
                      <tr>
                        <td>Trạng thái thanh toán:</td>
                        <td>
                          <span className={`status-pill pill-${String(selectedOrder.paymentStatus).toLowerCase()}`}>
                            {selectedOrder.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td>Tiền hàng (Tạm tính):</td>
                        <td>{formatCurrency(selectedOrder.subtotal)}</td>
                      </tr>
                      {selectedOrder.discount > 0 && (
                        <tr>
                          <td>Giảm giá:</td>
                          <td>-{formatCurrency(selectedOrder.discount)}</td>
                        </tr>
                      )}
                      <tr className="grand-total-row">
                        <td>TỔNG CỘNG:</td>
                        <td>{formatCurrency(selectedOrder.total)}</td>
                      </tr>
                      <tr>
                        <td>Số tiền shipper thu:</td>
                        <td>
                          {isCod(selectedOrder) ? (
                            <strong className="cod-highlight">{formatCurrency(selectedOrder.total)} (COD)</strong>
                          ) : (
                            <strong className="prepaid-highlight">0đ (Đã thanh toán trước)</strong>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-products-section">
                <h3>Danh sách sản phẩm ({selectedOrder.items?.length || 0})</h3>
                <div className="modal-table-wrapper">
                  <table className="modal-products-table">
                    <thead>
                      <tr>
                        <th>Tên sản phẩm</th>
                        <th>Kích cỡ</th>
                        <th>Số lượng</th>
                        <th>Đơn giá</th>
                        <th>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.items || []).map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.name}</td>
                          <td>{item.size || "Chuẩn"}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.unitPrice)}</td>
                          <td>{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="modal-action-wrapper">
                {selectedOrder.status === "PROCESSING" && (
                  <button
                    className="shipper-action-btn btn-pickup"
                    disabled={updatingOrderId === selectedOrder.id}
                    onClick={() => handleUpdateStatus(selectedOrder.id, "SHIPPING")}
                  >
                    {updatingOrderId === selectedOrder.id ? "Đang xử lý..." : "Lấy hàng & Bắt đầu giao"}
                  </button>
                )}
                {selectedOrder.status === "SHIPPING" && (
                  <div className="modal-button-group">
                    <button
                      className="shipper-action-btn btn-success"
                      disabled={updatingOrderId === selectedOrder.id}
                      onClick={() => handleUpdateStatus(selectedOrder.id, "COMPLETED")}
                    >
                      {updatingOrderId === selectedOrder.id ? "Đang xử lý..." : "Giao thành công"}
                    </button>
                    <button
                      className="shipper-action-btn btn-danger"
                      disabled={updatingOrderId === selectedOrder.id}
                      onClick={() => handleUpdateStatus(selectedOrder.id, "CANCELLED")}
                    >
                      {updatingOrderId === selectedOrder.id ? "Đang xử lý..." : "Giao thất bại"}
                    </button>
                  </div>
                )}
              </div>
              <button className="shipper-close-btn-footer" onClick={() => setSelectedOrder(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ShipperSimulatorPage;
