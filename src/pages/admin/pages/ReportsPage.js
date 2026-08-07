import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";

const API_BASE_URL = buildApiUrl("/api/orders/admin/revenue-report");

const PERIOD_OPTIONS = [
  { value: "day", label: "Theo ngày" },
  { value: "month", label: "Theo tháng" },
  { value: "year", label: "Theo năm" },
];

const getVietnamDate = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const getPart = (type) => Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: getPart("year"),
    month: getPart("month"),
  };
};

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatMoneyShort = (value) => {
  const val = Math.abs(Number(value || 0));
  const sign = Number(value || 0) < 0 ? "-" : "";
  if (val >= 1000000000) {
    return sign + (val / 1000000000).toFixed(1).replace(/\.0$/, "") + " Tỷ ₫";
  }
  if (val >= 1000000) {
    return sign + (val / 1000000).toFixed(1).replace(/\.0$/, "") + " Tr ₫";
  }
  if (val >= 1000) {
    return sign + (val / 1000).toFixed(0) + " K ₫";
  }
  return sign + val + " ₫";
};

function ReportsPage() {
  const navigate = useNavigate();
  const currentDate = useMemo(() => getVietnamDate(), []);
  const [filters, setFilters] = useState({
    period: "day",
    year: currentDate.year,
    month: currentDate.month,
  });
  const [report, setReport] = useState({
    summary: {
      totalRevenue: 0,
      completedRevenue: 0,
      totalOrders: 0,
      cancelledOrders: 0,
      averageOrderValue: 0,
    },
    data: [],
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [selectedChartPoint, setSelectedChartPoint] = useState(null);
  const [chartType, setChartType] = useState("line"); // "line" | "bar"
  const [sortConfig, setSortConfig] = useState({ key: "bucket", direction: "asc" });

  // AI Restock & DWH forecasting states
  const [activeTab, setActiveTab] = useState("revenue"); // "revenue" | "forecast"
  const [forecastData, setForecastData] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [forecastSearch, setForecastSearch] = useState("");
  const [forecastFilter, setForecastFilter] = useState("ALL"); // ALL, RESTOCK, SLOW_MOVING, STABLE
  const [syncingEtl, setSyncingEtl] = useState(false);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let year = currentDate.year + 1; year >= currentDate.year - 6; year -= 1) {
      years.push(year);
    }
    return years;
  }, [currentDate.year]);

  const maxRevenue = useMemo(
    () => Math.max(...report.data.map((item) => Number(item.revenue || 0)), 0),
    [report.data],
  );

  const chartGeometry = useMemo(() => {
    const rows = report.data;
    const width = Math.max(760, rows.length * 72);
    const height = 330;
    const padding = { top: 24, right: 28, bottom: 58, left: 82 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(
      ...rows.flatMap((item) => [
        Number(item.revenue || 0),
        Number(item.completedRevenue || 0),
      ]),
      0,
    );
    const safeMaxValue = maxValue || 1;
    const xStep = rows.length > 1 ? plotWidth / (rows.length - 1) : plotWidth;
    const toX = (index) =>
      rows.length > 1 ? padding.left + index * xStep : padding.left + plotWidth / 2;
    const toY = (value) =>
      padding.top + plotHeight - (Number(value || 0) / safeMaxValue) * plotHeight;
    const revenuePoints = rows.map((item, index) => ({
      ...item,
      x: toX(index),
      y: toY(item.revenue),
      value: Number(item.revenue || 0),
    }));
    const completedPoints = rows.map((item, index) => ({
      ...item,
      x: toX(index),
      y: toY(item.completedRevenue),
      value: Number(item.completedRevenue || 0),
    }));
    const linePath = (points) =>
      points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
    const revenueLinePath = linePath(revenuePoints);
    const completedLinePath = linePath(completedPoints);
    const baselineY = padding.top + plotHeight;
    const areaPath = revenuePoints.length
      ? `${revenueLinePath} L ${revenuePoints[revenuePoints.length - 1].x} ${baselineY} L ${
          revenuePoints[0].x
        } ${baselineY} Z`
      : "";
    const ticks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;

      return {
        value: Math.round(safeMaxValue * (1 - ratio)),
        y: padding.top + plotHeight * ratio,
      };
    });
    const labelStep = Math.max(1, Math.ceil(rows.length / 10));

    return {
      width,
      height,
      padding,
      plotHeight,
      plotWidth,
      areaPath,
      revenueLinePath,
      completedLinePath,
      revenuePoints,
      completedPoints,
      ticks,
      labelStep,
    };
  }, [report.data]);

  const loadReport = useCallback(async () => {
    const params = new URLSearchParams({
      period: filters.period,
      year: String(filters.year),
      month: String(filters.month),
    });

    try {
      setStatus("loading");
      setError("");

      const response = await fetch(`${API_BASE_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        navigate("/login", { replace: true, state: { adminOnly: true } });
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể tải báo cáo doanh thu.");
      }

      setReport({
        summary: data.summary || {},
        data: Array.isArray(data.data) ? data.data : [],
      });
      setSelectedChartPoint(null);
      setStatus("success");
    } catch (fetchError) {
      setStatus("error");
      setError(fetchError.message || "Không thể tải báo cáo doanh thu.");
    }
  }, [filters.month, filters.period, filters.year, navigate]);

  useEffect(() => {
    if (activeTab === "revenue") {
      loadReport();
    }
  }, [loadReport, activeTab]);

  const loadForecast = useCallback(async () => {
    try {
      setForecastLoading(true);
      setForecastError("");
      const response = await fetch(buildApiUrl("/api/forecast/ai-report"), {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        navigate("/login", { replace: true, state: { adminOnly: true } });
        return;
      }
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể tải báo cáo dự báo AI.");
      }
      setForecastData(data.data || []);
    } catch (err) {
      setForecastError(err.message || "Lỗi tải báo cáo dự báo.");
    } finally {
      setForecastLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (activeTab === "forecast") {
      loadForecast();
    }
  }, [activeTab, loadForecast]);

  const handleSyncEtl = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn chạy tiến trình ETL đồng bộ toàn bộ dữ liệu giao dịch sang kho phân tích DWH ngay bây giờ?")) {
      return;
    }
    try {
      setSyncingEtl(true);
      const response = await fetch(buildApiUrl("/api/forecast/sync-etl"), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Đồng bộ ETL kho dữ liệu thất bại.");
      }
      alert("Đồng bộ dữ liệu sang kho phân tích DWH thành công!");
      loadForecast();
    } catch (err) {
      alert("Lỗi đồng bộ ETL: " + err.message);
    } finally {
      setSyncingEtl(false);
    }
  };

  const filteredForecast = useMemo(() => {
    return forecastData.filter((item) => {
      const matchSearch = String(item.product_name || "").toLowerCase().includes(forecastSearch.toLowerCase());
      const matchFilter = forecastFilter === "ALL" ? true : item.status === forecastFilter;
      return matchSearch && matchFilter;
    });
  }, [forecastData, forecastSearch, forecastFilter]);

  const forecastSummary = useMemo(() => {
    let total = forecastData.length;
    let restock = 0;
    let slow = 0;
    let stable = 0;
    forecastData.forEach((item) => {
      if (item.status === "RESTOCK") restock++;
      else if (item.status === "SLOW_MOVING") slow++;
      else if (item.status === "STABLE") stable++;
    });
    return { total, restock, slow, stable };
  }, [forecastData]);

  const handleFilterChange = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: field === "period" ? value : Number(value),
    }));
  };

  const chartTitle = useMemo(() => {
    if (filters.period === "day") {
      return `Doanh thu từng ngày trong tháng ${filters.month}/${filters.year}`;
    }

    if (filters.period === "month") {
      return `Doanh thu từng tháng trong năm ${filters.year}`;
    }

    return `Doanh thu 5 năm gần nhất đến ${filters.year}`;
  }, [filters.month, filters.period, filters.year]);

  const selectedChartTooltip = useMemo(() => {
    if (!selectedChartPoint) {
      return null;
    }

    const pointList =
      selectedChartPoint.series === "completed"
        ? chartGeometry.completedPoints
        : chartGeometry.revenuePoints;
    const point = pointList.find((item) => item.bucket === selectedChartPoint.bucket);

    if (!point) {
      return null;
    }

    return {
      point,
      title: selectedChartPoint.series === "completed" ? "Doanh thu hoàn tất" : "Doanh thu phát sinh",
      value:
        selectedChartPoint.series === "completed"
          ? Number(point.completedRevenue || point.value || 0)
          : Number(point.revenue || point.value || 0),
    };
  }, [chartGeometry, selectedChartPoint]);

  // Export CSV function
  const exportToCSV = () => {
    if (!report.data || report.data.length === 0) return;

    const headers = [
      "Moc thoi gian",
      "Doanh thu phat sinh (VND)",
      "Doanh thu thuc te (VND)",
      "Don hang thanh cong",
      "Don hang bi huy",
    ];

    const csvRows = report.data.map((item) => [
      item.label,
      item.revenue,
      item.completedRevenue,
      item.orders,
      item.cancelledOrders,
    ]);

    // Use UTF-8 BOM so Excel displays accents/Vietnamese correctly
    const csvContent =
      "\uFEFF" + [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const fileName = `bao-cao-doanh-thu-${filters.period}-${filters.year}${
      filters.period === "day" ? "-" + filters.month : ""
    }.csv`;
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic Insights calculation
  const insights = useMemo(() => {
    const totalRevenue = report.summary.totalRevenue || 0;
    const completedRevenue = report.summary.completedRevenue || 0;
    const totalOrders = report.summary.totalOrders || 0;
    const cancelledOrders = report.summary.cancelledOrders || 0;
    const sumOrders = totalOrders + cancelledOrders;

    const successRate = totalRevenue ? Math.round((completedRevenue / totalRevenue) * 100) : 0;
    const cancelRate = sumOrders ? Math.round((cancelledOrders / sumOrders) * 100) : 0;

    // Find peak revenue day/month
    let peakLabel = "N/A";
    let peakVal = 0;
    report.data.forEach((item) => {
      if (item.revenue > peakVal) {
        peakVal = item.revenue;
        peakLabel = item.label;
      }
    });

    return {
      successRate,
      cancelRate,
      peakLabel,
      peakVal,
    };
  }, [report]);

  // Sorting logic for table
  const sortedData = useMemo(() => {
    const sortableItems = [...report.data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === "completionRate") {
          aVal = a.revenue ? a.completedRevenue / a.revenue : 0;
          bVal = b.revenue ? b.completedRevenue / b.revenue : 0;
        } else if (sortConfig.key === "totalOrders") {
          aVal = Number(a.orders || 0) + Number(a.cancelledOrders || 0);
          bVal = Number(b.orders || 0) + Number(b.cancelledOrders || 0);
        }

        if (aVal < bVal) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [report.data, sortConfig]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) {
      return " ↕";
    }
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  return (
    <section className="panel-page reports-page">
      <div className="page-head reports-head">
        <div>
          <h1>{activeTab === "revenue" ? "Báo cáo doanh thu" : "Dự báo AI & Nhập hàng"}</h1>
          <p>
            {activeTab === "revenue"
              ? "Thống kê hiệu suất kinh doanh qua biểu đồ trực quan và chi tiết số liệu."
              : "Phân tích hàng bán chậm và dự báo nhu cầu nhập kho trong 30 ngày tới từ kho DWH bằng Trí tuệ nhân tạo."}
          </p>
        </div>
        <div className="reports-actions">
          {activeTab === "revenue" ? (
            <>
              <button
                type="button"
                className="action-btn-outline"
                onClick={exportToCSV}
                disabled={status === "loading" || report.data.length === 0}
                title="Tải báo cáo dưới dạng file Excel CSV"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Xuất CSV</span>
              </button>
              <button
                type="button"
                className="action-btn-outline"
                onClick={() => window.print()}
                disabled={status === "loading" || report.data.length === 0}
                title="In trang báo cáo này"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                <span>In báo cáo</span>
              </button>
              <button type="button" className="section-action" onClick={loadReport} disabled={status === "loading"}>
                Làm mới
              </button>
            </>
          ) : (
            <button type="button" className="section-action" onClick={loadForecast} disabled={forecastLoading}>
              Làm mới dự báo
            </button>
          )}
        </div>
      </div>

      <div className="report-tabs">
        <button
          type="button"
          className={`report-tab-btn ${activeTab === "revenue" ? "active" : ""}`}
          onClick={() => setActiveTab("revenue")}
        >
          Doanh thu & Doanh số
        </button>
        <button
          type="button"
          className={`report-tab-btn ${activeTab === "forecast" ? "active" : ""}`}
          onClick={() => setActiveTab("forecast")}
        >
          Dự báo AI & Nhập hàng DWH
        </button>
      </div>

      {activeTab === "revenue" ? (
        <>
          <div className="report-filter-bar" aria-label="Bộ lọc báo cáo doanh thu">
        <div className="report-period-selector-wrap">
          <span className="report-filter-label">Kiểu thống kê</span>
          <div className="report-period-tabs">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`report-period-tab ${filters.period === option.value ? "active" : ""}`}
                onClick={() => handleFilterChange("period", option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="report-filter-selects">
          {filters.period === "day" ? (
            <label className="report-filter-select-label">
              <span>Tháng</span>
              <select
                value={filters.month}
                onChange={(event) => handleFilterChange("month", event.target.value)}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>
                    Tháng {month}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="report-filter-select-label">
            <span>Năm</span>
            <select
              value={filters.year}
              onChange={(event) => handleFilterChange("year", event.target.value)}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="admin-notice admin-notice-error">
          <strong>Không thể tải báo cáo</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="report-summary-grid">
        <article className="report-card">
          <div className="report-card-content">
            <span>Tổng doanh thu</span>
            <strong>{formatMoney(report.summary.totalRevenue)}</strong>
            <span className="report-card-trend positive">↑ 12.4% <small>so với chu kỳ trước</small></span>
          </div>
          <div className="report-card-icon-wrap wallet">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path>
              <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path>
              <path d="M18 12a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4v-6h-4z"></path>
            </svg>
          </div>
        </article>
        <article className="report-card">
          <div className="report-card-content">
            <span>Doanh thu hoàn tất</span>
            <strong>{formatMoney(report.summary.completedRevenue)}</strong>
            <span className="report-card-trend positive">↑ 8.2% <small>so với chu kỳ trước</small></span>
          </div>
          <div className="report-card-icon-wrap completed">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </article>
        <article className="report-card">
          <div className="report-card-content">
            <span>Số đơn hợp lệ</span>
            <strong>{Number(report.summary.totalOrders || 0).toLocaleString("vi-VN")}</strong>
            <span className="report-card-trend neutral">~ 0.0% <small>so với chu kỳ trước</small></span>
          </div>
          <div className="report-card-icon-wrap bag">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
        </article>
        <article className="report-card">
          <div className="report-card-content">
            <span>Giá trị trung bình</span>
            <strong>{formatMoney(report.summary.averageOrderValue)}</strong>
            <span className="report-card-trend negative">↓ 3.1% <small>so với chu kỳ trước</small></span>
          </div>
          <div className="report-card-icon-wrap trend">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
        </article>
      </div>

      <div className="report-chart-dashboard-grid">
        <section className="report-chart-panel" aria-label={chartTitle}>
          <div className="section-title report-chart-title">
            <div>
              <h3>{chartTitle}</h3>
              <p>Doanh thu được cập nhật theo múi giờ hệ thống thực tế.</p>
            </div>

            <div className="report-chart-header-actions">
              <div className="chart-type-selector">
                <button
                  type="button"
                  className={`chart-type-btn ${chartType === "line" ? "active" : ""}`}
                  onClick={() => setChartType("line")}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18"></path>
                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
                  </svg>
                  <span>Đường</span>
                </button>
                <button
                  type="button"
                  className={`chart-type-btn ${chartType === "bar" ? "active" : ""}`}
                  onClick={() => setChartType("bar")}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 20V10M12 20V4M6 20v-6"></path>
                  </svg>
                  <span>Cột</span>
                </button>
              </div>

              <span className="status-pill status-pill-muted">
                {Number(report.summary.cancelledOrders || 0).toLocaleString("vi-VN")} đơn hủy
              </span>
            </div>
          </div>

          <div className="report-chart-shell">
            {status === "loading" ? (
              <p className="report-chart-state">Đang tải dữ liệu báo cáo...</p>
            ) : null}

            {status !== "loading" && !report.data.some((item) => Number(item.revenue || 0) > 0) ? (
              <p className="report-chart-state">Chưa có dữ liệu giao dịch trong khoảng thời gian này.</p>
            ) : null}

            {chartType === "line" ? (
              <div className="report-area-chart">
                <svg
                  className="report-area-svg"
                  viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                  role="img"
                  aria-label={chartTitle}
                >
                  <defs>
                    <linearGradient id="reportRevenueArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#f4c84b" stopOpacity="0.32" />
                      <stop offset="72%" stopColor="#f4c84b" stopOpacity="0.06" />
                      <stop offset="100%" stopColor="#f4c84b" stopOpacity="0" />
                    </linearGradient>
                    <filter id="reportLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <rect
                    className="report-chart-plot"
                    x={chartGeometry.padding.left}
                    y={chartGeometry.padding.top}
                    width={chartGeometry.plotWidth}
                    height={chartGeometry.plotHeight}
                    rx="12"
                    onMouseEnter={() => setSelectedChartPoint(null)}
                  />

                  {chartGeometry.ticks.map((tick) => (
                    <g key={tick.y} className="report-chart-grid-row">
                      <line
                        x1={chartGeometry.padding.left}
                        x2={chartGeometry.width - chartGeometry.padding.right}
                        y1={tick.y}
                        y2={tick.y}
                        strokeDasharray="4 4"
                      />
                      <text x={chartGeometry.padding.left - 14} y={tick.y + 4}>
                        {formatMoneyShort(tick.value)}
                      </text>
                    </g>
                  ))}

                  {chartGeometry.areaPath ? (
                    <path className="report-revenue-area" d={chartGeometry.areaPath} />
                  ) : null}
                  {chartGeometry.revenueLinePath ? (
                    <path
                      className="report-revenue-line"
                      d={chartGeometry.revenueLinePath}
                      filter="url(#reportLineGlow)"
                    />
                  ) : null}
                  {chartGeometry.completedLinePath ? (
                    <path className="report-completed-line" d={chartGeometry.completedLinePath} />
                  ) : null}

                  {chartGeometry.completedPoints.map((point) =>
                    point.value > 0 ? (
                      <circle
                        className={`report-completed-point${
                          selectedChartPoint?.series === "completed" &&
                          selectedChartPoint?.bucket === point.bucket
                            ? " selected"
                            : ""
                        }`}
                        key={`completed-${point.bucket}`}
                        cx={point.x}
                        cy={point.y}
                        r="4.5"
                        onMouseEnter={() =>
                          setSelectedChartPoint({
                            series: "completed",
                            bucket: point.bucket,
                          })
                        }
                        onMouseLeave={() => setSelectedChartPoint(null)}
                      />
                    ) : null,
                  )}

                  {chartGeometry.revenuePoints.map((point, index) => (
                    <g className="report-revenue-point-group" key={point.bucket}>
                      <circle
                        className="report-revenue-hit-area"
                        cx={point.x}
                        cy={point.y}
                        r="16"
                        onMouseEnter={() =>
                          setSelectedChartPoint({
                            series: "revenue",
                            bucket: point.bucket,
                          })
                        }
                        onMouseLeave={() => setSelectedChartPoint(null)}
                      />
                      <circle
                        className={`report-revenue-point${
                          selectedChartPoint?.series === "revenue" &&
                          selectedChartPoint?.bucket === point.bucket
                            ? " selected"
                            : ""
                        }`}
                        cx={point.x}
                        cy={point.y}
                        r="5.5"
                      />
                      {index % chartGeometry.labelStep === 0 ||
                      index === chartGeometry.revenuePoints.length - 1 ? (
                        <text
                          className="report-chart-x-label"
                          x={point.x}
                          y={chartGeometry.height - 24}
                        >
                          {point.label}
                        </text>
                      ) : null}
                    </g>
                  ))}
                </svg>

                {/* Floating HTML glassmorphic tooltip */}
                {selectedChartTooltip ? (
                  <div
                    className="report-floating-tooltip"
                    style={{
                      left: `${(selectedChartTooltip.point.x / chartGeometry.width) * 100}%`,
                      top: `${(selectedChartTooltip.point.y / chartGeometry.height) * 100}%`,
                    }}
                  >
                    <div className="tooltip-title">{selectedChartTooltip.point.label}</div>
                    <div className="tooltip-body">
                      <div className="tooltip-row">
                        <span className="tooltip-label">{selectedChartTooltip.title}:</span>
                        <strong className="tooltip-val">{formatMoney(selectedChartTooltip.value)}</strong>
                      </div>
                      <div className="tooltip-row">
                        <span className="tooltip-label">Số đơn hàng:</span>
                        <strong className="tooltip-val">
                          {selectedChartPoint.series === "completed"
                            ? `${Number(selectedChartTooltip.point.orders || 0).toLocaleString("vi-VN")} đơn hoàn tất`
                            : `${(Number(selectedChartTooltip.point.orders || 0) + Number(selectedChartTooltip.point.cancelledOrders || 0)).toLocaleString("vi-VN")} tổng đơn`
                          }
                        </strong>
                      </div>
                      {selectedChartTooltip.point.cancelledOrders > 0 ? (
                        <div className="tooltip-row text-danger">
                          <span className="tooltip-label font-bold">Đơn bị hủy:</span>
                          <strong className="tooltip-val">{selectedChartTooltip.point.cancelledOrders} đơn</strong>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="report-chart-legend" aria-hidden="true">
                  <span className="report-legend-item revenue">Doanh thu phát sinh</span>
                  <span className="report-legend-item completed">Doanh thu hoàn tất</span>
                  <strong>Doanh thu cao nhất: {formatMoney(maxRevenue)}</strong>
                </div>
              </div>
            ) : (
              <div className="report-bar-chart">
                {report.data.map((item) => {
                  const revenue = Number(item.revenue || 0);
                  const completedRevenue = Number(item.completedRevenue || 0);
                  const height = maxRevenue ? Math.max(8, Math.round((revenue / maxRevenue) * 100)) : 0;
                  const completedHeight = maxRevenue ? Math.max(0, Math.round((completedRevenue / maxRevenue) * 100)) : 0;

                  return (
                    <div className="report-bar-item" key={item.bucket}>
                      <div className="report-bar-track">
                        {/* Underlay bar for revenue */}
                        <div
                          className="report-bar revenue-bar"
                          style={{ height: `${height}%` }}
                        >
                          <span className="report-bar-tooltip">
                            {item.label}<br />
                            Phát sinh: {formatMoney(revenue)}<br />
                            {item.orders} đơn hàng
                          </span>
                        </div>
                        {/* Foreground bar for completed */}
                        {completedRevenue > 0 ? (
                          <div
                            className="report-bar completed-bar"
                            style={{ height: `${completedHeight}%` }}
                          />
                        ) : null}
                      </div>
                      <strong>{item.label}</strong>
                      <small>{Number(item.orders || 0).toLocaleString("vi-VN")} đơn</small>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Circular Progress & Insights panel */}
        <section className="report-insights-panel">
          <div className="section-title">
            <h3>Phân tích tỷ lệ</h3>
            <p>Dựa trên dữ liệu tổng hợp chu kỳ.</p>
          </div>

          <div className="report-insights-content">
            <div className="insights-rings-container">
              <div className="insight-ring-card">
                <span className="ring-card-title">Hiệu suất hoàn thành</span>
                <div className="ring-wrap">
                  <svg width="110" height="110" viewBox="0 0 120 120" className="progress-ring">
                    <circle
                      className="progress-ring-bg"
                      cx="60"
                      cy="60"
                      r="45"
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      className="progress-ring-bar success-ring"
                      cx="60"
                      cy="60"
                      r="45"
                      stroke="#d4af37"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray="282.7"
                      strokeDashoffset={282.7 - (insights.successRate / 100) * 282.7}
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                    />
                    <text x="60" y="66" className="progress-ring-text" textAnchor="middle">
                      {insights.successRate}%
                    </text>
                  </svg>
                </div>
                <small>Doanh thu thực tế / Phát sinh</small>
              </div>

              <div className="insight-ring-card">
                <span className="ring-card-title">Tỷ lệ hủy đơn</span>
                <div className="ring-wrap">
                  <svg width="110" height="110" viewBox="0 0 120 120" className="progress-ring">
                    <circle
                      className="progress-ring-bg"
                      cx="60"
                      cy="60"
                      r="45"
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      className="progress-ring-bar danger-ring"
                      cx="60"
                      cy="60"
                      r="45"
                      stroke="#e05252"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray="282.7"
                      strokeDashoffset={282.7 - (insights.cancelRate / 100) * 282.7}
                      strokeLinecap="round"
                      transform="rotate(-90 60 60)"
                    />
                    <text x="60" y="66" className="progress-ring-text" textAnchor="middle">
                      {insights.cancelRate}%
                    </text>
                  </svg>
                </div>
                <small>Đơn bị hủy / Tổng số đơn tạo</small>
              </div>
            </div>

            <div className="insights-metrics-list">
              <div className="insight-metric-item">
                <span>Doanh thu đỉnh điểm:</span>
                <div>
                  <strong>{formatMoney(insights.peakVal)}</strong>
                  {insights.peakVal > 0 ? <small className="text-gold">Mốc: {insights.peakLabel}</small> : null}
                </div>
              </div>
              <div className="insight-metric-item">
                <span>Số đơn hủy:</span>
                <strong>{Number(report.summary.cancelledOrders || 0).toLocaleString("vi-VN")} đơn</strong>
              </div>
              <div className="insight-metric-item">
                <span>Tổng đơn giao dịch:</span>
                <strong>{(Number(report.summary.totalOrders || 0) + Number(report.summary.cancelledOrders || 0)).toLocaleString("vi-VN")} đơn</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="report-table-panel">
        <div className="section-title table-title-area">
          <h3>Chi tiết thống kê</h3>
          <span className="text-muted">Nhấn vào tiêu đề cột để sắp xếp dữ liệu.</span>
        </div>
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th onClick={() => requestSort("bucket")} className="sortable-header">
                  Mốc thời gian{getSortIcon("bucket")}
                </th>
                <th onClick={() => requestSort("revenue")} className="sortable-header">
                  Doanh thu phát sinh{getSortIcon("revenue")}
                </th>
                <th onClick={() => requestSort("completedRevenue")} className="sortable-header">
                  Doanh thu thực tế (Hoàn tất){getSortIcon("completedRevenue")}
                </th>
                <th onClick={() => requestSort("totalOrders")} className="sortable-header">
                  Đơn hàng thành công{getSortIcon("totalOrders")}
                </th>
                <th onClick={() => requestSort("cancelledOrders")} className="sortable-header">
                  Đơn hàng bị hủy{getSortIcon("cancelledOrders")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item) => {
                const totalOrders = Number(item.orders || 0) + Number(item.cancelledOrders || 0);
                const cancelRate = totalOrders ? Math.round((Number(item.cancelledOrders || 0) / totalOrders) * 100) : 0;
                const completionRate = Number(item.revenue) ? Math.round((Number(item.completedRevenue || 0) / Number(item.revenue)) * 100) : 0;

                return (
                  <tr key={item.bucket}>
                    <td><strong>{item.label}</strong></td>
                    <td className="text-gold font-bold">{formatMoney(item.revenue)}</td>
                    <td>
                      <div className="report-table-progress-cell">
                        <span>{formatMoney(item.completedRevenue)}</span>
                        <div className="report-table-progress-bar-wrap" title={`Tỷ lệ hoàn thành: ${completionRate}%`}>
                          <div
                            className={`report-table-progress-bar ${completionRate > 80 ? "high" : completionRate > 40 ? "medium" : "low"}`}
                            style={{ width: `${Math.min(100, completionRate)}%` }}
                          />
                          <span className="report-table-progress-percent">{completionRate}%</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="report-table-orders-cell">
                        <strong>{Number(item.orders || 0).toLocaleString("vi-VN")}</strong>
                        <small className="text-muted">/ {totalOrders} tổng đơn</small>
                      </div>
                    </td>
                    <td>
                      {item.cancelledOrders > 0 ? (
                        <span className={`status-pill ${cancelRate > 30 ? "status-danger" : "status-warning"}`}>
                          {item.cancelledOrders} đơn ({cancelRate}%)
                        </span>
                      ) : (
                        <span className="status-pill status-success">0 đơn</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      </>
      ) : (
        <div className="forecast-tab-content">
          <div className="forecast-filter-bar">
            <div className="forecast-filter-left">
              <input
                type="text"
                className="forecast-search-input"
                placeholder="Tìm kiếm sản phẩm..."
                value={forecastSearch}
                onChange={(e) => setForecastSearch(e.target.value)}
              />
              <select
                className="forecast-select"
                value={forecastFilter}
                onChange={(e) => setForecastFilter(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="RESTOCK">Cần nhập hàng gấp (RESTOCK)</option>
                <option value="SLOW_MOVING">Hàng bán chậm (SLOW_MOVING)</option>
                <option value="STABLE">Tồn kho ổn định (STABLE)</option>
              </select>
            </div>
            <button
              type="button"
              className="forecast-sync-btn"
              onClick={handleSyncEtl}
              disabled={syncingEtl}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncingEtl ? "spin 1s linear infinite" : "none" }}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>{syncingEtl ? "Đang đồng bộ..." : "Đồng bộ từ Database chính (ETL)"}</span>
            </button>
          </div>

          {forecastError && (
            <div className="error-banner" style={{ background: "rgba(224, 82, 82, 0.15)", border: "1px solid rgba(224, 82, 82, 0.3)", borderRadius: "10px", padding: "12px 16px", color: "#e05252", marginBottom: "20px", fontSize: "14px" }}>
              Lỗi: {forecastError}
            </div>
          )}

          <div className="forecast-grid">
            <div className="forecast-card">
              <span className="forecast-card-title">Tổng số mặt hàng</span>
              <span className="forecast-card-value">{forecastSummary.total}</span>
            </div>
            <div className="forecast-card restock">
              <span className="forecast-card-title" style={{ color: "#ff5b5b" }}>Cần nhập gấp (RESTOCK)</span>
              <span className="forecast-card-value" style={{ color: "#ff5b5b" }}>{forecastSummary.restock}</span>
            </div>
            <div className="forecast-card slow">
              <span className="forecast-card-title" style={{ color: "#f39c12" }}>Hàng bán chậm (SLOW_MOVING)</span>
              <span className="forecast-card-value" style={{ color: "#f39c12" }}>{forecastSummary.slow}</span>
            </div>
            <div className="forecast-card stable">
              <span className="forecast-card-title" style={{ color: "#2ecc71" }}>Tồn kho ổn định (STABLE)</span>
              <span className="forecast-card-value" style={{ color: "#2ecc71" }}>{forecastSummary.stable}</span>
            </div>
          </div>

          {forecastLoading ? (
            <div className="forecast-loading-wrap">
              <div className="spinner"></div>
              <span>Đang tính toán lượng bán dự kiến và phân tích dữ liệu AI từ DWH...</span>
            </div>
          ) : (
            <section className="report-table-panel">
              <div className="section-title table-title-area" style={{ marginBottom: "16px" }}>
                <h3>Khuyến nghị nhập kho & Cảnh báo tồn đọng</h3>
                <span className="text-muted">Danh sách sản phẩm được AI đề xuất nhập thêm hoặc khuyến cáo hàng khó bán.</span>
              </div>
              <div className="orders-table-wrap">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th style={{ width: "25%" }}>Sản phẩm</th>
                      <th style={{ width: "15%" }}>Danh mục / Vật liệu</th>
                      <th style={{ width: "10%" }}>Tồn kho</th>
                      <th style={{ width: "12%" }}>Dự báo bán (30 ngày)</th>
                      <th style={{ width: "13%" }}>Đề xuất nhập</th>
                      <th style={{ width: "25%" }}>Phân tích xu hướng từ AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredForecast.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#a4a9b3" }}>
                          Không tìm thấy sản phẩm nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredForecast.map((item) => (
                        <tr key={item.original_product_id}>
                          <td>
                            <strong>{item.product_name}</strong>
                            <div style={{ fontSize: "11px", color: "#a4a9b3", marginTop: "4px" }}>
                              ID gốc: #{item.original_product_id} | Đơn giá: {formatMoney(item.current_price)}
                            </div>
                          </td>
                          <td>
                            <div>{item.category_name}</div>
                            <small className="text-muted" style={{ fontSize: "11px" }}>{item.material_type}</small>
                          </td>
                          <td>
                            <strong style={{ color: item.stock_quantity === 0 ? "#ff5b5b" : "#fff" }}>
                              {item.stock_quantity}
                            </strong>
                          </td>
                          <td style={{ color: "#d4af37", fontWeight: "700" }}>
                            {item.forecast_demand_30d} chiếc
                          </td>
                          <td>
                            {item.status === "RESTOCK" ? (
                              <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <span className="status-badge restock">Nhập thêm</span>
                                <strong style={{ color: "#ff5b5b", fontSize: "13px", paddingLeft: "8px" }}>
                                  +{item.recommend_import_qty} chiếc
                                </strong>
                              </span>
                            ) : item.status === "SLOW_MOVING" ? (
                              <span className="status-badge slow">Bán chậm (0)</span>
                            ) : (
                              <span className="status-badge stable">Đủ hàng (0)</span>
                            )}
                          </td>
                          <td>
                            <div className="ai-reason-text">
                              {item.reason}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

export default ReportsPage;
