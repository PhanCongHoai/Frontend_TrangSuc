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
    const padding = { top: 24, right: 28, bottom: 58, left: 76 };
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
      setStatus("success");
    } catch (fetchError) {
      setStatus("error");
      setError(fetchError.message || "Không thể tải báo cáo doanh thu.");
    }
  }, [filters.month, filters.period, filters.year, navigate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

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

  return (
    <section className="panel-page reports-page">
      <div className="page-head reports-head">
        <div>
          <h1>Báo cáo doanh thu</h1>
          <p>Thống kê doanh thu bằng biểu đồ cột theo ngày, tháng và năm.</p>
        </div>
        <button type="button" className="section-action" onClick={loadReport} disabled={status === "loading"}>
          Làm mới
        </button>
      </div>

      <div className="report-filter-bar" aria-label="Bộ lọc báo cáo doanh thu">
        <label>
          <span>Kiểu thống kê</span>
          <select
            value={filters.period}
            onChange={(event) => handleFilterChange("period", event.target.value)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {filters.period === "day" ? (
          <label>
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

        <label>
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

      {error ? (
        <div className="admin-notice admin-notice-error">
          <strong>Không thể tải báo cáo</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="report-summary-grid">
        <article>
          <span>Tổng doanh thu</span>
          <strong>{formatMoney(report.summary.totalRevenue)}</strong>
        </article>
        <article>
          <span>Doanh thu hoàn tất</span>
          <strong>{formatMoney(report.summary.completedRevenue)}</strong>
        </article>
        <article>
          <span>Số đơn hợp lệ</span>
          <strong>{Number(report.summary.totalOrders || 0).toLocaleString("vi-VN")}</strong>
        </article>
        <article>
          <span>Giá trị trung bình</span>
          <strong>{formatMoney(report.summary.averageOrderValue)}</strong>
        </article>
      </div>

      <section className="report-chart-panel" aria-label={chartTitle}>
        <div className="section-title report-chart-title">
          <div>
            <h3>{chartTitle}</h3>
            <p>Đơn bị hủy không được tính vào tổng doanh thu.</p>
          </div>
          <span className="status-pill status-pill-muted">
            {Number(report.summary.cancelledOrders || 0).toLocaleString("vi-VN")} đơn hủy
          </span>
        </div>

        <div className="report-chart-shell">
          {status === "loading" ? (
            <p className="report-chart-state">Đang tải dữ liệu báo cáo...</p>
          ) : null}

          {status !== "loading" && !report.data.some((item) => Number(item.revenue || 0) > 0) ? (
            <p className="report-chart-state">Chưa có doanh thu trong khoảng thời gian này.</p>
          ) : null}

          <div className="report-area-chart">
            <svg
              className="report-area-svg"
              viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
              role="img"
              aria-label={chartTitle}
            >
              <defs>
                <linearGradient id="reportRevenueArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f4c84b" stopOpacity="0.36" />
                  <stop offset="72%" stopColor="#f4c84b" stopOpacity="0.08" />
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
                rx="16"
              />

              {chartGeometry.ticks.map((tick) => (
                <g key={tick.y} className="report-chart-grid-row">
                  <line
                    x1={chartGeometry.padding.left}
                    x2={chartGeometry.width - chartGeometry.padding.right}
                    y1={tick.y}
                    y2={tick.y}
                  />
                  <text x={chartGeometry.padding.left - 14} y={tick.y + 4}>
                    {formatMoney(tick.value)}
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
                    className="report-completed-point"
                    key={`completed-${point.bucket}`}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                  >
                    <title>{`${point.label} hoàn tất: ${formatMoney(point.value)}`}</title>
                  </circle>
                ) : null,
              )}

              {chartGeometry.revenuePoints.map((point, index) => (
                <g className="report-revenue-point-group" key={point.bucket}>
                  <circle className="report-revenue-hit-area" cx={point.x} cy={point.y} r="16">
                    <title>{`${point.label}: ${formatMoney(point.value)} - ${Number(
                      point.orders || 0,
                    ).toLocaleString("vi-VN")} đơn`}</title>
                  </circle>
                  <circle className="report-revenue-point" cx={point.x} cy={point.y} r="5" />
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
            <div className="report-chart-legend" aria-hidden="true">
              <span className="report-legend-item revenue">Doanh thu</span>
              <span className="report-legend-item completed">Hoàn tất</span>
              <strong>{formatMoney(maxRevenue)}</strong>
            </div>
          </div>

          <div className="report-bar-chart" aria-hidden="true">
            {report.data.map((item) => {
              const revenue = Number(item.revenue || 0);
              const height = maxRevenue ? Math.max(8, Math.round((revenue / maxRevenue) * 100)) : 0;

              return (
                <div className="report-bar-item" key={item.bucket}>
                  <div className="report-bar-track">
                    <div
                      className="report-bar"
                      style={{ height: `${height}%` }}
                      title={`${item.label}: ${formatMoney(revenue)}`}
                    >
                      {revenue > 0 ? <span>{formatMoney(revenue)}</span> : null}
                    </div>
                  </div>
                  <strong>{item.label}</strong>
                  <small>{Number(item.orders || 0).toLocaleString("vi-VN")} đơn</small>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="report-table-panel">
        <div className="section-title">
          <h3>Chi tiết thống kê</h3>
        </div>
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Mốc thời gian</th>
                <th>Doanh thu</th>
                <th>Doanh thu hoàn tất</th>
                <th>Số đơn</th>
                <th>Đơn hủy</th>
              </tr>
            </thead>
            <tbody>
              {report.data.map((item) => (
                <tr key={item.bucket}>
                  <td>{item.label}</td>
                  <td>{formatMoney(item.revenue)}</td>
                  <td>{formatMoney(item.completedRevenue)}</td>
                  <td>{Number(item.orders || 0).toLocaleString("vi-VN")}</td>
                  <td>{Number(item.cancelledOrders || 0).toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export default ReportsPage;
