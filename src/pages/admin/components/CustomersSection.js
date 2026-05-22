function CustomersSection({
  customerStats,
  customerList,
  changingCustomerId,
  customerSearch,
  onCustomerSearchChange,
  onToggleCustomerStatus,
}) {
  return (
    <section id="customers" className="customers-section">
      <div className="section-title">
        <h3>Quản lý khách hàng</h3>
      </div>

      <div className="customer-stats-grid">
        {customerStats.map((item) => (
          <article key={item.label} className="customer-stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="customer-toolbar">
        <label className="customer-search">
          <span>Tìm theo email</span>
          <div className="customer-search-shell">
            <span className="customer-search-icon" aria-hidden="true">
              @
            </span>
            <input
              type="text"
              value={customerSearch}
              onChange={(event) => onCustomerSearchChange(event.target.value)}
              placeholder="VD: ten@example.com"
            />
            {customerSearch ? (
              <button
                type="button"
                className="customer-search-clear"
                onClick={() => onCustomerSearchChange("")}
              >
                Xóa
              </button>
            ) : null}
            <button
              type="button"
              className="customer-search-submit"
              aria-label="Tìm kiếm khách hàng"
            >
              &#128269;
            </button>
          </div>
        </label>
      </div>

      <div className="orders-table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Mã KH</th>
              <th>Tên khách</th>
              <th>Email</th>
              <th>Số đơn</th>
              <th>Chi tiêu</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {customerList.length ? (
              customerList.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.code || customer.id}</td>
                  <td>{customer.name}</td>
                  <td>{customer.email}</td>
                  <td>{customer.orders}</td>
                  <td>{customer.spend}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        customer.isActive ? "status-pill-success" : "status-pill-muted"
                      }`}
                    >
                      {customer.isActive ? "Đang hoạt động" : "Đã bị chặn"}
                    </span>
                    {!customer.isActive && customer.blockReason ? (
                      <small className="customer-block-reason-note">
                        Lý do: {customer.blockReason}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={customer.isActive ? "danger-action" : "section-action"}
                      onClick={() => onToggleCustomerStatus(customer)}
                      disabled={changingCustomerId === customer.id}
                    >
                      {changingCustomerId === customer.id
                        ? "Đang cập nhật..."
                        : customer.isActive
                          ? "Chặn tài khoản"
                          : "Mở chặn"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">Không tìm thấy khách hàng phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default CustomersSection;
