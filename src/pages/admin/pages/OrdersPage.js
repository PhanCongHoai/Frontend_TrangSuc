import { useCallback, useEffect, useMemo, useState } from "react";
import OrdersSection from "../components/OrdersSection";
import { getAccessToken, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";

const ORDERS_API = buildApiUrl("/api/orders/admin/list");
const STATUS_API = buildApiUrl("/api/orders/admin");
const ORDERS_PAGE_SIZE = 10;

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

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
      setSummary(Array.isArray(data.summary) ? data.summary : []);
      setStatus("success");
    } catch (fetchError) {
      setOrders([]);
      setSummary([]);
      setStatus("error");
      setError(fetchError.message || "Không thể tải danh sách đơn hàng.");
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      return undefined;
    }

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

  const filteredOrders = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesKeyword =
        !keyword ||
        String(order.code || "").toLowerCase().includes(keyword) ||
        String(order.customer || "").toLowerCase().includes(keyword) ||
        String(order.email || "").toLowerCase().includes(keyword) ||
        String(order.phone || "").toLowerCase().includes(keyword) ||
        String(order.item || "").toLowerCase().includes(keyword);

      return matchesStatus && matchesKeyword;
    });
  }, [orders, searchKeyword, statusFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE)),
    [filteredOrders.length]
  );

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ORDERS_PAGE_SIZE;
    return filteredOrders.slice(startIndex, startIndex + ORDERS_PAGE_SIZE);
  }, [currentPage, filteredOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, statusFilter]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  const handleUpdateOrderStatus = async (orderId, nextStatus) => {
    try {
      setUpdatingOrderId(orderId);
      setError("");
      setFeedback(null);

      const response = await fetch(`${STATUS_API}/${orderId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể cập nhật trạng thái đơn hàng.");
      }

      setFeedback({
        type: "success",
        title: "Đã cập nhật đơn hàng.",
        message: `Đơn OD${String(orderId).padStart(5, "0")} đã chuyển sang ${
          data.order?.statusLabel || nextStatus
        }.`,
      });
      await loadOrders();
    } catch (updateError) {
      setFeedback({
        type: "error",
        title: "Cập nhật thất bại.",
        message: updateError.message || "Không thể cập nhật trạng thái đơn hàng.",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <section className="panel-page">
      {status === "loading" ? (
        <div className="admin-notice">
          <strong>Đang tải danh sách đơn hàng...</strong>
          <p>Hệ thống đang đọc dữ liệu đơn hàng từ backend.</p>
        </div>
      ) : null}

      {error ? (
        <div className="admin-notice admin-notice-error">
          <strong>Không thể xử lý dữ liệu đơn hàng.</strong>
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
        <OrdersSection
          orders={paginatedOrders}
          summary={summary}
          totalOrders={orders.length}
          filteredOrdersCount={filteredOrders.length}
          searchKeyword={searchKeyword}
          statusFilter={statusFilter}
          currentPage={currentPage}
          totalPages={totalPages}
          updatingOrderId={updatingOrderId}
          onSearchChange={setSearchKeyword}
          onStatusFilterChange={setStatusFilter}
          onPageChange={setCurrentPage}
          onRefresh={loadOrders}
          onUpdateOrderStatus={handleUpdateOrderStatus}
        />
      ) : null}
    </section>
  );
}

export default OrdersPage;
