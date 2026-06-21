import { useCallback, useEffect, useMemo, useState } from "react";
import OrdersSection from "../components/OrdersSection";
import { getAccessToken, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";

const ORDERS_API = buildApiUrl("/api/orders/admin/list");
const STATUS_API = buildApiUrl("/api/orders/admin");
const ORDERS_PAGE_SIZE = 10;

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

      let matchesDate = true;
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (orderDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) matchesDate = false;
        }
      }

      const matchesKeyword =
        !keyword ||
        String(order.code || "").toLowerCase().includes(keyword) ||
        String(order.customer || "").toLowerCase().includes(keyword) ||
        String(order.email || "").toLowerCase().includes(keyword) ||
        String(order.phone || "").toLowerCase().includes(keyword) ||
        String(order.item || "").toLowerCase().includes(keyword);

      return matchesStatus && matchesDate && matchesKeyword;
    });
  }, [orders, searchKeyword, statusFilter, startDate, endDate]);

  const calculatedSummary = useMemo(() => {
    const countByStatus = filteredOrders.reduce((acc, order) => {
      const status = String(order.status || "").toUpperCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const totalRevenue = filteredOrders
      .filter((order) => String(order.status || "").toUpperCase() === "COMPLETED")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    const formatCurrencyVnd = (value) =>
      new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(value);

    return [
      { label: "Tổng đơn hàng", value: String(filteredOrders.length) },
      { label: "Chờ xác nhận", value: String(countByStatus.PENDING || 0) },
      { label: "Đang xử lý", value: String(countByStatus.PROCESSING || 0) },
      { label: "Đang giao", value: String(countByStatus.SHIPPING || 0) },
      { label: "Hoàn tất", value: String(countByStatus.COMPLETED || 0) },
      { label: "Doanh thu thực tế", value: formatCurrencyVnd(totalRevenue) },
    ];
  }, [filteredOrders]);

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
  }, [searchKeyword, statusFilter, startDate, endDate]);

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
          summary={calculatedSummary}
          totalOrders={orders.length}
          filteredOrdersCount={filteredOrders.length}
          searchKeyword={searchKeyword}
          statusFilter={statusFilter}
          startDate={startDate}
          endDate={endDate}
          currentPage={currentPage}
          totalPages={totalPages}
          updatingOrderId={updatingOrderId}
          onSearchChange={setSearchKeyword}
          onStatusFilterChange={setStatusFilter}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onPageChange={setCurrentPage}
          onRefresh={loadOrders}
          onUpdateOrderStatus={handleUpdateOrderStatus}
        />
      ) : null}
    </section>
  );
}

export default OrdersPage;
