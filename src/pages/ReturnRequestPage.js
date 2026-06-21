import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "./Header";
import Footer from "./footer/Footer";
import { getAuthHeaders, getCurrentUser } from "../utils/auth";
import { buildApiUrl } from "../utils/api";
import { formatCurrency } from "../utils/pricing";
import "./ReturnRequestPage.css";

const ORDERS_API = buildApiUrl("/api/orders");

function ReturnRequestPage() {
  const [currentUser] = useState(() => getCurrentUser());
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [reason, setReason] = useState("");
  
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load orders to select
  useEffect(() => {
    if (!currentUser) return;

    const loadOrders = async () => {
      try {
        const response = await fetch(`${ORDERS_API}/my`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        if (data.success) {
          // Lọc các đơn đã giao / hoàn thành
          const eligible = (data.data || []).filter(
            (ord) =>
              String(ord.status || "").trim().toUpperCase() === "COMPLETED" ||
              String(ord.status || "").trim().toUpperCase() === "DELIVERED"
          );
          setOrders(eligible);
        }
      } catch (err) {
        console.error("Lỗi tải đơn hàng:", err);
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOrders();
  }, [currentUser]);

  // Load return requests history
  const loadReturns = async () => {
    if (!currentUser) return;
    try {
      setLoadingReturns(true);
      const response = await fetch(`${ORDERS_API}/my/returns`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        setReturns(data.data || []);
      }
    } catch (err) {
      console.error("Lỗi tải yêu cầu hoàn hàng:", err);
    } finally {
      setLoadingReturns(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrderId || !bankName || !accountNumber || !accountHolderName) {
      setError("Vui lòng điền đầy đủ các trường thông tin bắt buộc.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${ORDERS_API}/my/returns`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: Number(selectedOrderId),
          bankName,
          accountNumber,
          accountHolderName,
          reason,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Gửi yêu cầu hoàn hàng thất bại.");
      }

      setMessage(data.message || "Gửi yêu cầu thành công!");
      setSelectedOrderId("");
      setBankName("");
      setAccountNumber("");
      setAccountHolderName("");
      setReason("");
      loadReturns(); // Reload history
    } catch (err) {
      setError(err.message || "Đã xảy ra lỗi.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusLabel = (status) => {
    switch (String(status).toUpperCase()) {
      case "PENDING":
        return { label: "Chờ đối soát", className: "status-pending" };
      case "COMPLETED":
        return { label: "Đã hoàn tiền", className: "status-completed" };
      case "REJECTED":
        return { label: "Đã từ chối", className: "status-rejected" };
      default:
        return { label: status, className: "" };
    }
  };

  if (!currentUser) {
    return (
      <div className="returns-page">
        <Header />
        <main className="returns-shell">
          <section className="returns-empty-state">
            <h1>Bạn cần đăng nhập để yêu cầu hoàn hàng</h1>
            <p>Vui lòng đăng nhập tài khoản của bạn để gửi yêu cầu hoàn tiền.</p>
            <Link to="/login" className="returns-primary-button">
              Đăng nhập ngay
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="returns-page">
      <Header />
      <main className="returns-shell">
        <div className="returns-grid">
          
          {/* Form gửi yêu cầu */}
          <section className="returns-card returns-form-card">
            <div className="returns-card-header">
              <span className="returns-kicker">Hoàn hàng & Hoàn tiền</span>
              <h2>Yêu cầu hoàn trả đơn hàng</h2>
              <p>Chính sách hoàn trả áp dụng cho đơn hàng đã giao thành công.</p>
            </div>

            <form onSubmit={handleSubmit} className="returns-form">
              {error && <div className="returns-alert error">{error}</div>}
              {message && <div className="returns-alert success">{message}</div>}

              <label htmlFor="order-select">
                <span>Chọn đơn hàng hoàn trả *</span>
                <select
                  id="order-select"
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  disabled={loadingOrders}
                  required
                >
                  <option value="">
                    {loadingOrders ? "Đang tải đơn hàng..." : "-- Chọn đơn hàng đã giao --"}
                  </option>
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.orderCode || `#DH-${ord.id}`} - {formatCurrency(ord.total)} (Ngày đặt: {new Date(ord.createdAt).toLocaleDateString("vi-VN")})
                    </option>
                  ))}
                </select>
                {orders.length === 0 && !loadingOrders && (
                  <small className="returns-form-help warning">
                    Bạn không có đơn hàng nào ở trạng thái "Đã giao" hợp lệ để hoàn trả.
                  </small>
                )}
              </label>

              <div className="form-row-2">
                <label htmlFor="bank-name">
                  <span>Tên ngân hàng *</span>
                  <input
                    id="bank-name"
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Ví dụ: Vietcombank, Techcombank..."
                    required
                  />
                </label>

                <label htmlFor="account-number">
                  <span>Số tài khoản *</span>
                  <input
                    id="account-number"
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Nhập số tài khoản nhận tiền"
                    required
                  />
                </label>
              </div>

              <label htmlFor="account-holder">
                <span>Tên chủ tài khoản *</span>
                <input
                  id="account-holder"
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Ví dụ: NGUYEN VAN A"
                  required
                />
              </label>

              <label htmlFor="return-reason">
                <span>Lý do hoàn tiền</span>
                <textarea
                  id="return-reason"
                  rows="3"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Mô tả chi tiết lý do bạn muốn trả hàng và nhận lại tiền..."
                />
              </label>

              <button
                type="submit"
                className="returns-submit-button"
                disabled={submitting || orders.length === 0}
              >
                {submitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu hoàn tiền"}
              </button>
            </form>
          </section>

          {/* Lịch sử yêu cầu */}
          <section className="returns-card returns-history-card">
            <div className="returns-card-header">
              <span className="returns-kicker">Lịch sử</span>
              <h2>Yêu cầu đã gửi</h2>
              <p>Danh sách các yêu cầu hoàn trả và trạng thái đối soát.</p>
            </div>

            {loadingReturns ? (
              <p className="loading-text">Đang tải lịch sử yêu cầu...</p>
            ) : returns.length === 0 ? (
              <div className="returns-empty-history">
                <p>Bạn chưa gửi yêu cầu hoàn tiền nào.</p>
              </div>
            ) : (
              <div className="returns-history-list">
                {returns.map((ret) => {
                  const statusInfo = getStatusLabel(ret.status);
                  return (
                    <article className="returns-history-item" key={ret.id}>
                      <div className="item-header">
                        <strong>Mã đơn: {ret.orderCode}</strong>
                        <span className={`status-badge ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="item-body">
                        <p><span>Số tiền:</span> <strong>{formatCurrency(ret.amount)}</strong></p>
                        <p><span>Ngân hàng:</span> {ret.bankName} - SỐ TK: {ret.accountNumber} ({ret.accountHolderName})</p>
                        {ret.reason && <p><span>Lý do:</span> {ret.reason}</p>}
                        <small className="item-date">
                          Ngày yêu cầu: {new Date(ret.createdAt).toLocaleString("vi-VN")}
                        </small>
                        {ret.transferredAt && (
                          <small className="item-date success-text">
                            Ngày nhận tiền: {new Date(ret.transferredAt).toLocaleString("vi-VN")}
                          </small>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </main>
      <Footer />
    </div>
  );
}

export default ReturnRequestPage;
