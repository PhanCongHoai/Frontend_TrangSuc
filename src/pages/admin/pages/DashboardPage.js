import StatsGrid from "../components/StatsGrid";
import { stats } from "../data/adminData";

function DashboardPage() {
  return (
    <section className="panel-page">
      <div className="page-head">
        <h1>Bảng điều khiển</h1>
        <p>Tổng quan hoạt động hệ thống theo thời gian thực.</p>
      </div>
      <StatsGrid stats={stats} />
    </section>
  );
}

export default DashboardPage;
