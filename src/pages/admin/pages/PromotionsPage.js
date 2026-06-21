import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";

function PromotionsPage() {
  const navigate = useNavigate();
  
  // States for Promotions
  const [promotions, setPromotions] = useState([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  
  // States for Customers (for distribution selection)
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // States for Form creation
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("percentage");
  const [minOrder, setMinOrder] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [isActive, setIsActive] = useState(true);

  // States for Distribution action
  const [distPromoId, setDistPromoId] = useState("");
  const [targetType, setTargetType] = useState("all"); // 'all' or 'selected'

  // General States
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleSessionExpired = useCallback(() => {
    clearAuthSession();
    navigate("/login", {
      replace: true,
      state: { from: "/admin/promotions", adminOnly: true },
    });
  }, [navigate]);

  // Formatter helper
  const formatCurrency = (val) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // 1. Fetch Promotions
  const fetchPromotions = useCallback(async () => {
    try {
      setLoadingPromos(true);
      setError("");
      const response = await fetch(buildApiUrl("/api/promotions/admin/list"), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        handleSessionExpired();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể tải danh sách khuyến mãi.");
      }

      setPromotions(data.data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi tải danh sách khuyến mãi.");
    } finally {
      setLoadingPromos(false);
    }
  }, [handleSessionExpired]);

  // 2. Fetch Customers
  const fetchCustomers = useCallback(async () => {
    try {
      setLoadingCustomers(true);
      const response = await fetch(buildApiUrl("/api/customers"), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        handleSessionExpired();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể tải danh sách khách hàng.");
      }

      setCustomers(data.customerList || []);
    } catch (err) {
      console.error(err);
      showFeedback("error", "Lỗi tải khách hàng", err.message);
    } finally {
      setLoadingCustomers(false);
    }
  }, [handleSessionExpired]);



  useEffect(() => {
    fetchPromotions();
    fetchCustomers();
  }, [fetchPromotions, fetchCustomers]);

  // Show dynamic feedback popup/toast
  const showFeedback = (type, title, message) => {
    setFeedback({ type, title, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.title === title ? null : prev));
    }, 5000);
  };

  // 3. Create Promotion Submit
  const handleCreatePromotion = async (e) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !type) {
      showFeedback("error", "Lỗi nhập liệu", "Vui lòng điền đầy đủ Mã, Tên và Loại khuyến mãi.");
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type,
        min_order: minOrder ? Number(minOrder) : 0,
        discount_percent: type === "percentage" ? Number(discountPercent) : 0,
        discount_amount: type === "fixed" ? Number(discountAmount) : 0,
        free_shipping: type === "free_shipping" ? true : false,
        is_active: isActive,
      };

      const response = await fetch(buildApiUrl("/api/promotions/admin/create"), {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        handleSessionExpired();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Tạo mã khuyến mãi thất bại.");
      }

      showFeedback("success", "Thành công", "Tạo mã khuyến mãi thành công!");
      
      // Reset Form fields
      setCode("");
      setName("");
      setType("percentage");
      setMinOrder("");
      setDiscountPercent("");
      setDiscountAmount("");
      setIsActive(true);

      // Refresh list
      fetchPromotions();
    } catch (err) {
      showFeedback("error", "Lỗi tạo khuyến mãi", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Delete Promotion
  const handleDeletePromotion = async (id, promoCode) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mã khuyến mãi "${promoCode}" không? Việc này sẽ hủy bỏ các liên kết phát hành tương ứng.`)) {
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/api/promotions/admin/${id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        handleSessionExpired();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Xóa khuyến mãi thất bại.");
      }

      showFeedback("success", "Thành công", `Đã xóa mã khuyến mãi "${promoCode}".`);
      fetchPromotions();
      
      // Clear distribute selection if it was selected
      if (Number(distPromoId) === Number(id)) {
        setDistPromoId("");
      }
    } catch (err) {
      showFeedback("error", "Lỗi xóa khuyến mãi", err.message);
    }
  };

  // 5. Distribute Promotion Submit
  const handleDistributePromotion = async (e) => {
    e.preventDefault();
    if (!distPromoId) {
      showFeedback("error", "Thiếu thông tin", "Vui lòng chọn một mã khuyến mãi để phát hành.");
      return;
    }

    if (targetType === "selected" && selectedUserIds.length === 0) {
      showFeedback("error", "Thiếu thông tin", "Bạn cần chọn ít nhất một khách hàng để phát mã.");
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        promotionId: Number(distPromoId),
        targetType,
        userIds: targetType === "selected" ? selectedUserIds : [],
      };

      const response = await fetch(buildApiUrl("/api/promotions/admin/distribute"), {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        handleSessionExpired();
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Phát mã khuyến mãi thất bại.");
      }

      showFeedback("success", "Phát hành thành công", data.message || "Đã gửi mã ưu đãi tới khách hàng.");
      
      // Reset selections
      setSelectedUserIds([]);
    } catch (err) {
      showFeedback("error", "Lỗi phát khuyến mãi", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter customer list based on Search Email keyword
  const filteredCustomers = useMemo(() => {
    const keyword = customerSearch.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter(
      (c) =>
        String(c.email || "").toLowerCase().includes(keyword) ||
        String(c.name || "").toLowerCase().includes(keyword)
    );
  }, [customers, customerSearch]);

  // Handle select/unselect all customers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const activeIds = filteredCustomers.filter(c => c.isActive).map((c) => c.id);
      setSelectedUserIds(activeIds);
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSelectCustomer = (id) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  return (
    <div className="admin-page-container">
      {/* Toast Notification */}
      {feedback && (
        <div className={`admin-feedback-toast ${feedback.type}`}>
          <div className="toast-content">
            <h4>{feedback.title}</h4>
            <p>{feedback.message}</p>
          </div>
          <button className="toast-close" onClick={() => setFeedback(null)}>×</button>
        </div>
      )}

      <div className="admin-header">
        <h1>Quản lý Khuyến mãi</h1>
        <p>Cấu hình các chương trình ưu đãi và phát hành mã giảm giá cho khách hàng mua sắm.</p>
      </div>

      {error && <div className="admin-error-banner">{error}</div>}

      <div className="promotions-grid">
        {/* LEFT COLUMN: Create Form */}
        <div className="promotions-card glass-panel">
          <h2 className="card-title">Tạo Chương trình Khuyến mãi</h2>
          <form onSubmit={handleCreatePromotion} className="promo-form">
            <div className="form-group">
              <label htmlFor="code">Mã khuyến mãi <span className="required">*</span></label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ví dụ: TIKTOK10, SUMMER25"
                required
                disabled={actionLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="name">Tên chương trình <span className="required">*</span></label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Giảm giá mùa hè 2026"
                required
                disabled={actionLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="type">Loại ưu đãi <span className="required">*</span></label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={actionLoading}
              >
                <option value="percentage">Phần trăm (%)</option>
                <option value="fixed">Số tiền cố định (VNĐ)</option>
                <option value="free_shipping">Miễn phí vận chuyển (Freeship)</option>
              </select>
            </div>

            {type === "percentage" && (
              <div className="form-group">
                <label htmlFor="percent">Mức giảm (%) <span className="required">*</span></label>
                <input
                  id="percent"
                  type="number"
                  min="1"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="Ví dụ: 10, 20"
                  required
                  disabled={actionLoading}
                />
              </div>
            )}

            {type === "fixed" && (
              <div className="form-group">
                <label htmlFor="amount">Số tiền giảm (VNĐ) <span className="required">*</span></label>
                <input
                  id="amount"
                  type="number"
                  min="1000"
                  step="1000"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="Ví dụ: 50000, 100000"
                  required
                  disabled={actionLoading}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="minOrder">Giá trị đơn hàng tối thiểu (VNĐ)</label>
              <input
                id="minOrder"
                type="number"
                min="0"
                step="10000"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="Mặc định: 0đ"
                disabled={actionLoading}
              />
            </div>

            <div className="form-group-checkbox">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={actionLoading}
                />
                <span className="checkmark"></span>
                Kích hoạt chương trình ngay lập tức
              </label>
            </div>

            <button
              type="submit"
              className="gold-btn btn-full"
              disabled={actionLoading}
            >
              {actionLoading ? "Đang xử lý..." : "Tạo chương trình"}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Promotions List */}
        <div className="promotions-card glass-panel">
          <h2 className="card-title">Chương trình khuyến mãi hiện có</h2>
          {loadingPromos ? (
            <div className="loading-container">Đang tải danh sách khuyến mãi...</div>
          ) : promotions.length === 0 ? (
            <div className="empty-state">
              <p>Chưa có chương trình khuyến mãi nào được tạo.</p>
            </div>
          ) : (
            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Tên chương trình</th>
                    <th>Loại ưu đãi</th>
                    <th>Giá trị giảm</th>
                    <th>Đơn tối thiểu</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((promo) => (
                    <tr key={promo.id}>
                      <td className="bold text-gold">{promo.code}</td>
                      <td className="promo-name-cell">{promo.name}</td>
                      <td>
                        {promo.type === "percentage"
                          ? "Phần trăm"
                          : promo.type === "fixed"
                          ? "Số tiền cố định"
                          : "Miễn phí ship"}
                      </td>
                      <td>
                        {promo.type === "percentage"
                          ? `${promo.discount_percent}%`
                          : promo.type === "fixed"
                          ? formatCurrency(promo.discount_amount)
                          : "Freeship"}
                      </td>
                      <td>{formatCurrency(promo.min_order)}</td>
                      <td>
                        <span className={`status-badge ${promo.is_active ? "active" : "inactive"}`}>
                          {promo.is_active ? "Kích hoạt" : "Tạm dừng"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="delete-icon-btn"
                          onClick={() => handleDeletePromotion(promo.id, promo.code)}
                          title="Xóa khuyến mãi"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z"></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: Distribute Promotions */}
      <div className="distribute-section glass-panel">
        <h2 className="card-title">Phát hành mã khuyến mãi cho khách hàng</h2>
        <form onSubmit={handleDistributePromotion} className="distribute-form">
          <div className="distribute-grid">
            {/* Selection Column */}
            <div className="distribute-inputs">
              <div className="form-group">
                <label htmlFor="distPromo">Chọn mã khuyến mãi <span className="required">*</span></label>
                <select
                  id="distPromo"
                  value={distPromoId}
                  onChange={(e) => setDistPromoId(e.target.value)}
                  disabled={actionLoading}
                  required
                >
                  <option value="">-- Chọn một mã hoạt động --</option>
                  {promotions
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label>Đối tượng nhận mã <span className="required">*</span></label>
                <div className="radio-group">
                  <label className="radio-container">
                    <input
                      type="radio"
                      name="targetType"
                      value="all"
                      checked={targetType === "all"}
                      onChange={() => setTargetType("all")}
                      disabled={actionLoading}
                    />
                    <span className="radio-checkmark"></span>
                    Tất cả khách hàng
                  </label>
                  <label className="radio-container">
                    <input
                      type="radio"
                      name="targetType"
                      value="selected"
                      checked={targetType === "selected"}
                      onChange={() => setTargetType("selected")}
                      disabled={actionLoading}
                    />
                    <span className="radio-checkmark"></span>
                    Khách hàng được chọn
                  </label>
                </div>
              </div>

              <div className="distribute-summary">
                <p>
                  <strong>Hình thức phát hành:</strong>{" "}
                  {targetType === "all" ? "Gửi toàn bộ danh sách khách hàng đang hoạt động." : "Gửi tới các tài khoản được đánh dấu chọn bên phải."}
                </p>
                {targetType === "selected" && (
                  <p>
                    <strong>Số lượng khách đã chọn:</strong>{" "}
                    <span className="text-gold bold">{selectedUserIds.length}</span> người
                  </p>
                )}
                <button
                  type="submit"
                  className="gold-btn"
                  disabled={actionLoading || promotions.filter((p) => p.is_active).length === 0}
                >
                  {actionLoading ? "Đang phát..." : "Xác nhận phát mã"}
                </button>
              </div>
            </div>

            {/* Customers Checklist Column */}
            {targetType === "selected" && (
              <div className="customers-selection-box">
                <div className="box-header">
                  <h3>Danh sách khách hàng ({filteredCustomers.length})</h3>
                  <div className="search-box-container">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Tìm theo email, tên..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      disabled={loadingCustomers}
                    />
                    <svg className="search-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <path d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.13401 14.866 4 11 4C7.13401 4 4 7.13401 4 11C4 14.866 7.13401 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z"></path>
                    </svg>
                  </div>
                </div>

                {loadingCustomers ? (
                  <div className="loading-container">Đang tải khách hàng...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="empty-state-sm">Không tìm thấy khách hàng nào.</div>
                ) : (
                  <div className="checkbox-table-wrapper">
                    <table className="checklist-table">
                      <thead>
                        <tr>
                          <th width="40">
                            <label className="checkbox-container no-text">
                              <input
                                type="checkbox"
                                onChange={handleSelectAll}
                                checked={
                                  filteredCustomers.length > 0 &&
                                  filteredCustomers.filter(c => c.isActive).every((c) =>
                                    selectedUserIds.includes(c.id)
                                  )
                                }
                              />
                              <span className="checkmark"></span>
                            </label>
                          </th>
                          <th>Mã</th>
                          <th>Tên khách hàng</th>
                          <th>Email</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((cust) => (
                          <tr
                            key={cust.id}
                            className={`${!cust.isActive ? "row-blocked" : ""} ${
                              selectedUserIds.includes(cust.id) ? "row-selected" : ""
                            }`}
                            onClick={() => cust.isActive && handleSelectCustomer(cust.id)}
                            style={{ cursor: cust.isActive ? "pointer" : "not-allowed" }}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <label className="checkbox-container no-text">
                                <input
                                  type="checkbox"
                                  checked={selectedUserIds.includes(cust.id)}
                                  onChange={() => handleSelectCustomer(cust.id)}
                                  disabled={!cust.isActive}
                                />
                                <span className="checkmark"></span>
                              </label>
                            </td>
                            <td>{cust.code}</td>
                            <td className="bold">{cust.name}</td>
                            <td>{cust.email}</td>
                            <td>
                              <span className={`status-badge ${cust.isActive ? "active" : "inactive"}`}>
                                {cust.isActive ? "Hoạt động" : "Bị chặn"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default PromotionsPage;
