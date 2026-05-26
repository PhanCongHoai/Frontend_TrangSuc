import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomersSection from "../components/CustomersSection";
import { clearAuthSession, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";

function CustomersPage() {
  const navigate = useNavigate();
  const [customerStats, setCustomerStats] = useState([]);
  const [customerList, setCustomerList] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [changingCustomerId, setChangingCustomerId] = useState(null);
  const [pendingCustomerAction, setPendingCustomerAction] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const fetchCustomers = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");

      const response = await fetch(buildApiUrl("/api/customers"), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        navigate("/login", {
          replace: true,
          state: { from: "/admin/customers", adminOnly: true },
        });
        throw new Error(
          "Phiên đăng nhập admin đã hết hạn hoặc không còn quyền truy cập. Vui lòng đăng nhập lại."
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể tải dữ liệu khách hàng.");
      }

      setCustomerStats(Array.isArray(data.customerStats) ? data.customerStats : []);
      setCustomerList(Array.isArray(data.customerList) ? data.customerList : []);
      setStatus("success");
    } catch (fetchError) {
      console.error("Fetch admin customers error:", fetchError);
      setCustomerStats([]);
      setCustomerList([]);
      setStatus("error");
      setError(fetchError.message || "Không thể tải dữ liệu khách hàng.");
    }
  }, [navigate]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomerList = useMemo(() => {
    const keyword = customerSearch.trim().toLowerCase();

    if (!keyword) {
      return customerList;
    }

    return customerList.filter((customer) =>
      String(customer.email || "").toLowerCase().includes(keyword)
    );
  }, [customerList, customerSearch]);

  const handleAskToggleCustomerStatus = (customer) => {
    setFeedback(null);
    setPendingCustomerAction(customer);
    setBlockReason(customer.blockReason || "");
  };

  const handleConfirmToggleCustomerStatus = async () => {
    if (!pendingCustomerAction) {
      return;
    }

    const customer = pendingCustomerAction;
    const nextIsActive = !customer.isActive;
    const normalizedBlockReason = blockReason.trim();

    if (!nextIsActive && !normalizedBlockReason) {
      setFeedback({
        type: "error",
        title: "Thiếu lý do khóa tài khoản.",
        message: "Vui lòng nhập lý do để hệ thống thông báo rõ cho khách hàng.",
      });
      return;
    }

    try {
      setChangingCustomerId(customer.id);
      setError("");

      const response = await fetch(
        buildApiUrl(`/api/customers/${customer.id}/status`),
        {
          method: "PATCH",
          headers: {
            ...getAuthHeaders({
              "Content-Type": "application/json",
            }),
          },
          body: JSON.stringify({
            is_active: nextIsActive,
            block_reason: nextIsActive ? "" : normalizedBlockReason,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        navigate("/login", {
          replace: true,
          state: { from: "/admin/customers", adminOnly: true },
        });
        throw new Error(
          "Phiên đăng nhập admin đã hết hạn hoặc không còn quyền truy cập. Vui lòng đăng nhập lại."
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Không thể cập nhật trạng thái tài khoản.");
      }

      setCustomerList((prev) =>
        prev.map((item) =>
          item.id === customer.id
            ? {
                ...item,
                isActive: nextIsActive,
                blockReason: data.customer?.blockReason || "",
                blockedAt: data.customer?.blockedAt || null,
              }
            : item
        )
      );

      setCustomerStats((prev) =>
        prev.map((item) => {
          if (item.label === "Tài khoản hoạt động") {
            return {
              ...item,
              value: String(Number(item.value || 0) + (nextIsActive ? 1 : -1)),
            };
          }

          if (item.label === "Tài khoản bị chặn") {
            return {
              ...item,
              value: String(Number(item.value || 0) + (nextIsActive ? -1 : 1)),
            };
          }

          return item;
        })
      );

      setFeedback({
        type: "success",
        title: nextIsActive ? "Đã mở chặn tài khoản." : "Đã chặn tài khoản.",
        message: nextIsActive
          ? `Tài khoản "${customer.name}" đã được mở lại.`
          : `Tài khoản "${customer.name}" đã bị chặn. Lý do: ${normalizedBlockReason}`,
      });
      setPendingCustomerAction(null);
      setBlockReason("");
    } catch (updateError) {
      console.error("Update customer status error:", updateError);
      const message =
        updateError.message || "Không thể cập nhật trạng thái tài khoản.";
      setError(message);
      setFeedback({
        type: "error",
        title: "Cập nhật trạng thái thất bại.",
        message,
      });
    } finally {
      setChangingCustomerId(null);
    }
  };

  return (
    <section className="panel-page">
      <div className="page-head">
        <h1>Quản lý khách hàng</h1>
        <p>Theo dõi thông tin khách hàng và thao tác chặn tài khoản trực tiếp.</p>
      </div>

      {status === "loading" ? (
        <div className="admin-notice">
          <strong>Đang tải dữ liệu khách hàng...</strong>
          <p>Hệ thống đang đọc dữ liệu thật từ backend.</p>
        </div>
      ) : null}

      {error ? (
        <div className="admin-notice admin-notice-error">
          <strong>Không thể xử lý dữ liệu khách hàng.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`admin-notice ${
            feedback.type === "error" ? "admin-notice-error" : "admin-notice-success"
          }`}
        >
          <strong>{feedback.title}</strong>
          <p>{feedback.message}</p>
        </div>
      ) : null}

      {status === "success" ? (
        <CustomersSection
          customerStats={customerStats}
          customerList={filteredCustomerList}
          changingCustomerId={changingCustomerId}
          customerSearch={customerSearch}
          onCustomerSearchChange={setCustomerSearch}
          onToggleCustomerStatus={handleAskToggleCustomerStatus}
        />
      ) : null}

      {pendingCustomerAction ? (
        <div
          className="customer-action-backdrop"
          onClick={() => setPendingCustomerAction(null)}
        >
          <div
            className="customer-action-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="customer-action-kicker">Xác nhận thao tác</p>
            <h3>
              {pendingCustomerAction.isActive
                ? "Chặn tài khoản khách hàng?"
                : "Mở chặn tài khoản khách hàng?"}
            </h3>
            <p>
              {pendingCustomerAction.isActive
                ? `Sau khi chặn, tài khoản "${pendingCustomerAction.name}" sẽ không thể đăng nhập và sử dụng các API cần xác thực.`
                : `Tài khoản "${pendingCustomerAction.name}" sẽ được phép đăng nhập và sử dụng hệ thống trở lại.`}
            </p>

            {pendingCustomerAction.isActive ? (
              <label className="customer-block-reason-field">
                <span>Lý do khóa tài khoản</span>
                <textarea
                  value={blockReason}
                  maxLength={500}
                  rows={4}
                  placeholder="VD: Tài khoản có dấu hiệu đặt hàng ảo nhiều lần..."
                  onChange={(event) => setBlockReason(event.target.value)}
                />
                <small>{blockReason.trim().length}/500 ký tự</small>
              </label>
            ) : pendingCustomerAction.blockReason ? (
              <div className="customer-current-block-reason">
                <strong>Lý do đang khóa</strong>
                <p>{pendingCustomerAction.blockReason}</p>
              </div>
            ) : null}

            <div className="customer-action-actions">
              <button
                type="button"
                className="section-action"
                onClick={() => setPendingCustomerAction(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className={
                  pendingCustomerAction.isActive ? "danger-action" : "customer-confirm-action"
                }
                onClick={handleConfirmToggleCustomerStatus}
                disabled={changingCustomerId === pendingCustomerAction.id}
              >
                {changingCustomerId === pendingCustomerAction.id
                  ? "Đang cập nhật..."
                  : pendingCustomerAction.isActive
                    ? "Xác nhận chặn"
                    : "Xác nhận mở chặn"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default CustomersPage;
