const ORDER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "PROCESSING", label: "Đang xử lý" },
  { value: "SHIPPING", label: "Đang giao" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
];

function OrdersSection({
  orders,
  summary,
  totalOrders,
  searchKeyword,
  statusFilter,
  updatingOrderId,
  onSearchChange,
  onStatusFilterChange,
  onRefresh,
  onUpdateOrderStatus,
}) {
  return (
    <section id="orders" className="orders-section orders-admin-section">
      <div className="section-title orders-admin-title">
        <div>
          <h3>Danh sách đơn hàng</h3>
          <p>
            Đang hiển thị {orders.length}/{totalOrders} đơn hàng.
          </p>
        </div>
        <button type="button" onClick={onRefresh}>
          Làm mới
        </button>
      </div>

      <div className="customer-stats-grid orders-summary-grid">
        {summary.map((item) => (
          <article key={item.label} className="customer-stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="orders-admin-toolbar">
        <label className="customer-search orders-admin-search">
          <span>Tìm đơn hàng</span>
          <div className="customer-search-shell">
            <span className="customer-search-icon" aria-hidden="true">
              #
            </span>
            <input
              type="search"
              value={searchKeyword}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Mã đơn, khách hàng, email, số điện thoại, sản phẩm..."
            />
            {searchKeyword ? (
              <button
                type="button"
                className="customer-search-clear"
                onClick={() => onSearchChange("")}
              >
                Xóa
              </button>
            ) : null}
          </div>
        </label>

        <label className="orders-status-filter">
          <span>Trạng thái</span>
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="all">Tất cả</option>
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="orders-table-wrap">
        <table className="orders-table orders-admin-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Sản phẩm</th>
              <th>Thanh toán</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {orders.length ? (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.code}</strong>
                    <small>{order.createdAtLabel}</small>
                  </td>
                  <td>
                    <strong>{order.customer}</strong>
                    <small>{order.phone || order.email || "Chưa có liên hệ"}</small>
                    {order.address ? <small>{order.address}</small> : null}
                  </td>
                  <td>
                    <strong>{order.item}</strong>
                    <div className="orders-item-list">
                      {(order.items || []).slice(0, 3).map((item) => (
                        <small key={`${order.id}-${item.variantId}`}>
                          {item.name} x{item.quantity}
                        </small>
                      ))}
                      {(order.items || []).length > 3 ? (
                        <small>+{order.items.length - 3} sản phẩm khác</small>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span>{order.paymentLabel || "Chưa xác định"}</span>
                    <small>{order.paymentStatus || "Chưa cập nhật"}</small>
                    {order.shippingCode ? <small>GHN: {order.shippingCode}</small> : null}
                  </td>
                  <td>
                    <strong>{order.formattedTotal}</strong>
                  </td>
                  <td>
                    <span className={`status-pill order-status-pill order-status-${order.status.toLowerCase()}`}>
                      {order.statusLabel}
                    </span>
                  </td>
                  <td>
                    <select
                      className="orders-status-select"
                      value={order.status}
                      disabled={updatingOrderId === order.id}
                      onChange={(event) => onUpdateOrderStatus(order.id, event.target.value)}
                    >
                      {ORDER_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {updatingOrderId === order.id ? <small>Đang lưu...</small> : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">Không có đơn hàng phù hợp với bộ lọc hiện tại.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default OrdersSection;
