import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";
import { formatCurrency } from "../../../utils/pricing";

const RETURNS_ADMIN_API = buildApiUrl("/api/orders/admin/returns");

function ReturnRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  
  // Status Filter and Pagination States
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Custom Modal States
  const [confirmModal, setConfirmModal] = useState({ show: false, data: null });
  const [alertModal, setAlertModal] = useState({ show: false, type: "success", title: "", message: "" });
  const [rejectModal, setRejectModal] = useState({ show: false, data: null, reason: "" });

  const loadReturnRequests = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");

      const response = await fetch(RETURNS_ADMIN_API, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        navigate("/login", {
          replace: true,
          state: { from: "/admin/return-requests", adminOnly: true },
        });
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể tải danh sách yêu cầu hoàn hàng.");
      }

      setRequests(Array.isArray(data.data) ? data.data : []);
      setStatus("success");
    } catch (fetchError) {
      setRequests([]);
      setStatus("error");
      setError(fetchError.message || "Không thể tải danh sách yêu cầu hoàn tiền.");
    }
  }, [navigate]);

  useEffect(() => {
    loadReturnRequests();
  }, [loadReturnRequests]);

  const handleOpenConfirm = (req) => {
    setConfirmModal({
      show: true,
      data: req,
    });
  };

  const handleConfirmRefund = async () => {
    const target = confirmModal.data;
    if (!target) return;
    
    const { id } = target;
    setConfirmModal({ show: false, data: null });
    setActionLoadingId(id);

    try {
      const response = await fetch(`${RETURNS_ADMIN_API}/${id}/confirm`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Xác nhận hoàn tiền thất bại.");
      }

      setAlertModal({
        show: true,
        type: "success",
        title: "Xác nhận thành công",
        message: "Xác nhận hoàn tiền thành công! Hệ thống đã chuyển đổi trạng thái đơn hàng và gửi mail thông báo tới khách hàng.",
      });
      // Tải lại dữ liệu
      loadReturnRequests();
    } catch (err) {
      setAlertModal({
        show: true,
        type: "error",
        title: "Xác nhận thất bại",
        message: err.message || "Đã xảy ra lỗi trong quá trình đối soát đơn hàng.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenReject = (req) => {
    setRejectModal({
      show: true,
      data: req,
      reason: "",
    });
  };

  const handleRejectRefund = async () => {
    const target = rejectModal.data;
    if (!target) return;
    
    const { id } = target;
    const reasonToSend = rejectModal.reason;
    setRejectModal({ show: false, data: null, reason: "" });
    setActionLoadingId(id);

    try {
      const response = await fetch(`${RETURNS_ADMIN_API}/${id}/reject`, {
        method: "PATCH",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ reason: reasonToSend }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Từ chối yêu cầu hoàn tiền thất bại.");
      }

      setAlertModal({
        show: true,
        type: "success",
        title: "Từ chối thành công",
        message: "Đã từ chối yêu cầu hoàn tiền! Hệ thống đã gửi email và tin nhắn thông báo lý do tới khách hàng.",
      });
      loadReturnRequests();
    } catch (err) {
      setAlertModal({
        show: true,
        type: "error",
        title: "Từ chối thất bại",
        message: err.message || "Đã xảy ra lỗi trong quá trình xử lý từ chối hoàn tiền.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusLabel = (reqStatus) => {
    switch (String(reqStatus).toUpperCase()) {
      case "PENDING":
        return <span className="status-pill status-warning">Chờ hoàn tiền</span>;
      case "COMPLETED":
        return <span className="status-pill status-success">Đã hoàn tiền</span>;
      case "REJECTED":
        return <span className="status-pill status-danger">Đã từ chối</span>;
      default:
        return <span className="status-pill status-neutral">{reqStatus}</span>;
    }
  };

  // Filter logic
  const filteredRequests = useMemo(() => {
    if (filterStatus === "ALL") return requests;
    return requests.filter(req => String(req.status).toUpperCase() === filterStatus.toUpperCase());
  }, [requests, filterStatus]);

  // Pagination logic
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  }, [filteredRequests]);

  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredRequests.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRequests, currentPage]);

  return (
    <section className="panel-page">
      <div className="page-head">
        <h1>Đối soát đơn hoàn trả</h1>
        <p>Danh sách các yêu cầu hoàn hàng & hoàn tiền từ khách hàng cần đối soát giao dịch chuyển khoản ngân hàng.</p>
      </div>

      {status === "loading" && (
        <div className="admin-notice">
          <strong>Đang tải danh sách yêu cầu...</strong>
          <p>Hệ thống đang đồng bộ danh sách hoàn tiền từ cơ sở dữ liệu.</p>
        </div>
      )}

      {error && (
        <div className="admin-notice admin-notice-error">
          <strong>Không thể tải danh sách.</strong>
          <p>{error}</p>
        </div>
      )}

      {status === "success" && (
        <>
          <div className="orders-admin-toolbar" style={{ margin: "20px 0 16px" }}>
            <div className="orders-status-filter">
              <span>Lọc theo trạng thái hoàn</span>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PENDING">Chờ hoàn tiền</option>
                <option value="COMPLETED">Đã hoàn tiền</option>
                <option value="REJECTED">Không chấp nhận hoàn tiền</option>
              </select>
            </div>
            <div></div>
            <button
              type="button"
              className="orders-refresh-button"
              onClick={loadReturnRequests}
            >
              Làm mới dữ liệu
            </button>
          </div>

          <div className="orders-table-wrap">
            {paginatedRequests.length === 0 ? (
              <div className="admin-empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "#888" }}>
                <p>Không tìm thấy yêu cầu hoàn tiền nào phù hợp.</p>
              </div>
            ) : (
              <table className="orders-table return-requests-table">
                <thead>
                  <tr>
                    <th>Mã đơn hàng</th>
                    <th>Khách hàng</th>
                    <th>Thông tin nhận tiền</th>
                    <th>Số tiền hoàn</th>
                    <th>Lý do hoàn trả</th>
                    <th>Ngày yêu cầu</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "center" }}>Thao tác đối soát</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRequests.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <div className="return-order-code">{req.orderCode}</div>
                        <small style={{ color: "#888", fontSize: "11px" }}>ID Đơn: {req.orderId}</small>
                      </td>
                      <td>
                        <div className="return-customer-name">{req.customerName}</div>
                        <small style={{ color: "#888", fontSize: "11px" }}>{req.email}</small>
                      </td>
                      <td>
                        <div className="return-bank-details">
                          <div><strong>Ngân hàng:</strong> {req.bankName}</div>
                          <div><strong>Số TK:</strong> {req.accountNumber}</div>
                          <div><strong>Chủ TK:</strong> {req.accountHolderName}</div>
                        </div>
                      </td>
                      <td>
                        <span className="return-amount-highlight">{formatCurrency(req.amount)}</span>
                      </td>
                      <td>
                        <div className="return-reason-text">
                          {req.reason || <em style={{ color: "#666" }}>Không có lý do chi tiết</em>}
                        </div>
                      </td>
                      <td>
                        <div className="return-date-text">
                          {new Date(req.createdAt).toLocaleString("vi-VN")}
                        </div>
                      </td>
                      <td>
                        {getStatusLabel(req.status)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {req.status === "PENDING" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                            <button
                              type="button"
                              className="return-action-btn"
                              disabled={actionLoadingId !== null}
                              onClick={() => handleOpenConfirm(req)}
                              style={{ width: "130px" }}
                            >
                              {actionLoadingId === req.id ? "Đang xử lý..." : "Xác nhận đối soát"}
                            </button>
                            <button
                              type="button"
                              className="return-action-btn return-reject-btn"
                              disabled={actionLoadingId !== null}
                              onClick={() => handleOpenReject(req)}
                              style={{ width: "130px" }}
                            >
                              Không đồng ý
                            </button>
                          </div>
                        ) : req.status === "REJECTED" ? (
                          <div style={{ color: "#ff5b5b", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                            <span style={{ fontWeight: "700", fontSize: "13px" }}>❌ Đã từ chối</span>
                          </div>
                        ) : (
                          <div style={{ color: "#55d6be", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                            <span style={{ fontWeight: "700", fontSize: "13px" }}>✅ Đã đối soát</span>
                            {req.transferredAt && (
                              <small style={{ color: "#888", fontSize: "11px" }}>
                                {new Date(req.transferredAt).toLocaleString("vi-VN")}
                              </small>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {filteredRequests.length > PAGE_SIZE && (
            <div className="pagination-bar">
              <button
                type="button"
                className="pagination-button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Trước
              </button>

              <div className="pagination-pages">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1;

                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      className={`pagination-page ${
                        currentPage === pageNumber ? "active" : ""
                      }`}
                      onClick={() => setCurrentPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="pagination-button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <div className="admin-modal-icon warning">⚠️</div>
              <h3>Xác nhận chuyển khoản</h3>
            </div>
            <div className="admin-modal-body">
              <p>Bạn đã thực hiện chuyển tiền hoàn số tiền <strong>{formatCurrency(confirmModal.data.amount)}</strong> cho đơn hàng <strong>{confirmModal.data.orderCode}</strong>?</p>
              <div className="return-bank-details" style={{ width: "100%", marginTop: "12px", background: "rgba(255,255,255,0.04)" }}>
                <div><strong>Ngân hàng nhận:</strong> {confirmModal.data.bankName}</div>
                <div><strong>Số tài khoản:</strong> {confirmModal.data.accountNumber}</div>
                <div><strong>Chủ tài khoản:</strong> {confirmModal.data.accountHolderName}</div>
              </div>
              <p style={{ marginTop: "12px", color: "#f4c84b", fontSize: "12px" }}>⚠️ Lưu ý: Hành động này sẽ thay đổi trạng thái đơn hàng gốc sang <strong>Đã hủy/Hoàn tiền</strong> và hệ thống sẽ tự động gửi email xác nhận hoàn trả về hòm thư của khách hàng.</p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-modal-btn cancel"
                onClick={() => setConfirmModal({ show: false, data: null })}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="admin-modal-btn confirm"
                onClick={handleConfirmRefund}
              >
                Xác nhận đã chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.show && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <div className="admin-modal-icon error">❌</div>
              <h3 style={{ color: "#ff5b5b" }}>Từ chối yêu cầu hoàn tiền</h3>
            </div>
            <div className="admin-modal-body">
              <p>Bạn có chắc chắn muốn từ chối yêu cầu hoàn tiền cho đơn hàng <strong>{rejectModal.data.orderCode}</strong>?</p>
              
              <label style={{ display: "block", marginTop: "14px" }}>
                <span style={{ display: "block", marginBottom: "6px", color: "#ccc", fontSize: "13px" }}>Lý do từ chối (Gửi tới khách hàng):</span>
                <textarea
                  rows="3"
                  className="admin-modal-input"
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Nhập lý do từ chối..."
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "8px",
                    fontSize: "13px",
                    resize: "none",
                  }}
                />
              </label>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-modal-btn cancel"
                onClick={() => setRejectModal({ show: false, data: null, reason: "" })}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="admin-modal-btn confirm"
                onClick={handleRejectRefund}
                style={{ background: "#ff5b5b" }}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert / Notification Modal */}
      {alertModal.show && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <div className={`admin-modal-icon ${alertModal.type}`}>
                {alertModal.type === "success" ? "✅" : "❌"}
              </div>
              <h3 style={{ color: alertModal.type === "success" ? "#55d6be" : "#ff5b5b" }}>
                {alertModal.title}
              </h3>
            </div>
            <div className="admin-modal-body">
              <p>{alertModal.message}</p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-modal-btn confirm"
                onClick={() => setAlertModal({ show: false, type: "success", title: "", message: "" })}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ReturnRequestsPage;
