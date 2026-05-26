const ORDER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "PROCESSING", label: "Đang xử lý" },
  { value: "SHIPPING", label: "Đang giao" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const ORDERS_PAGE_SIZE = 10;

function OrdersSection({
  orders,
  summary,
  totalOrders,
  filteredOrdersCount,
  searchKeyword,
  statusFilter,
  currentPage,
  totalPages,
  updatingOrderId,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onRefresh,
  onUpdateOrderStatus,
}) {
  const visiblePageNumbers = [];
  const pageWindowStart = Math.max(1, currentPage - 2);
  const pageWindowEnd = Math.min(totalPages, currentPage + 2);

  if (pageWindowStart > 1) {
    visiblePageNumbers.push(1);
    if (pageWindowStart > 2) {
      visiblePageNumbers.push("start-ellipsis");
    }
  }

  for (let pageNumber = pageWindowStart; pageNumber <= pageWindowEnd; pageNumber += 1) {
    visiblePageNumbers.push(pageNumber);
  }

  if (pageWindowEnd < totalPages) {
    if (pageWindowEnd < totalPages - 1) {
      visiblePageNumbers.push("end-ellipsis");
    }
    visiblePageNumbers.push(totalPages);
  }

  return (
    <section id="orders" className="orders-section orders-admin-section">
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

        <button type="button" className="orders-refresh-button" onClick={onRefresh}>
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

      {filteredOrdersCount > ORDERS_PAGE_SIZE ? (
        <div className="pagination-bar">
          <button
            type="button"
            className="pagination-button"
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
          >
            Truoc
          </button>

          <div className="pagination-pages">
            {visiblePageNumbers.map((pageNumber) =>
              typeof pageNumber === "number" ? (
                <button
                  key={pageNumber}
                  type="button"
                  className={`pagination-page ${currentPage === pageNumber ? "active" : ""}`}
                  onClick={() => onPageChange(pageNumber)}
                >
                  {pageNumber}
                </button>
              ) : (
                <span key={pageNumber} className="pagination-ellipsis">
                  ...
                </span>
              )
            )}
          </div>

          <button
            type="button"
            className="pagination-button"
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Sau
          </button>
        </div>
      ) : null}

      <p className="orders-admin-footnote">
        Đang hiển thị {orders.length}/{filteredOrdersCount} đơn hàng phù hợp. Tổng tất cả:{" "}
        {totalOrders}.
      </p>
    </section>
  );
}

export default OrdersSection;
