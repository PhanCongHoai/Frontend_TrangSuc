import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatsGrid from "../components/StatsGrid";
import { clearAuthSession, getAuthHeaders } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";

const API_BASE_URL = buildApiUrl("/api/orders/admin/dashboard-summary");

function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const loadDashboardSummary = useCallback(async () => {
    try {
      setStatus("loading");
      setError("");

      const response = await fetch(API_BASE_URL, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        navigate("/login", {
          replace: true,
          state: { from: "/admin/dashboard", adminOnly: true },
        });
        return;
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể tải dữ liệu bảng điều khiển.");
      }

      setStats(Array.isArray(data.stats) ? data.stats : []);
      setStatus("success");
    } catch (fetchError) {
      setStats([]);
      setStatus("error");
      setError(fetchError.message || "Không thể tải dữ liệu bảng điều khiển.");
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboardSummary();
  }, [loadDashboardSummary]);

  return (
    <section className="panel-page">
      <div className="page-head">
        <h1>Bảng điều khiển</h1>
        <p>Tổng quan hoạt động hệ thống theo thời gian thực.</p>
      </div>

      {status === "loading" ? (
        <div className="admin-notice">
          <strong>Đang tải dữ liệu bảng điều khiển...</strong>
          <p>Hệ thống đang lấy các chỉ số thật từ cơ sở dữ liệu.</p>
        </div>
      ) : null}

      {error ? (
        <div className="admin-notice admin-notice-error">
          <strong>Không thể tải bảng điều khiển.</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {status === "success" ? <StatsGrid stats={stats} /> : null}
    </section>
  );
}

export default DashboardPage;
