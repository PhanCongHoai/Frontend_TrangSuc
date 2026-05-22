import { Outlet } from "react-router-dom";
import "./Admin.css";
import AdminSidebar from "./components/AdminSidebar";

function Admin() {
  return (
    <div className="admin-page">
      <AdminSidebar />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

export default Admin;
