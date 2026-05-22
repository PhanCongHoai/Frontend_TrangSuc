import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { clearAuthSession, getAuthHeaders, getCurrentUser } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/api";

const CHAT_ADMIN_API = buildApiUrl("/api/chat/admin/conversations");
const CHAT_BADGE_REFRESH_MS = 5000;

function AdminSidebar() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadChatUnreadCount = async () => {
      try {
        const response = await fetch(CHAT_ADMIN_API, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok || !data?.success) {
          return;
        }

        const nextCount = (data.conversations || []).reduce(
          (sum, conversation) => sum + Number(conversation.unreadCount || 0),
          0
        );

        if (isMounted) {
          setChatUnreadCount(nextCount);
        }
      } catch {
        if (isMounted) {
          setChatUnreadCount(0);
        }
      }
    };

    loadChatUnreadCount();
    const intervalId = window.setInterval(loadChatUnreadCount, CHAT_BADGE_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const chatUnreadLabel = useMemo(
    () => (chatUnreadCount > 99 ? "99+" : String(chatUnreadCount)),
    [chatUnreadCount]
  );

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="admin-sidebar">
      <h2>Quản trị</h2>
      <p className="admin-sidebar-user">{currentUser?.email || "Phiên quản trị"}</p>

      <nav className="admin-sidebar-nav">
        <NavLink to="/admin/dashboard" className="admin-nav-link">
          Bảng điều khiển
        </NavLink>
        <NavLink to="/admin/orders" className="admin-nav-link">
          Đơn hàng
        </NavLink>
        <NavLink to="/admin/reports" className="admin-nav-link">
          Báo cáo doanh thu
        </NavLink>
        <NavLink to="/admin/products" className="admin-nav-link">
          Sản phẩm
        </NavLink>
        <NavLink to="/admin/banners" className="admin-nav-link">
          Banner
        </NavLink>
        <NavLink to="/admin/gold-rates" className="admin-nav-link">
          Giá vàng và bạc
        </NavLink>
        <NavLink to="/admin/categories" className="admin-nav-link">
          Danh mục
        </NavLink>
        <NavLink to="/admin/customers" className="admin-nav-link">
          Khách hàng
        </NavLink>
        <NavLink to="/admin/chats" className="admin-nav-link">
          <span>Tin nhắn</span>
          {chatUnreadCount > 0 ? (
            <span className="admin-nav-badge" aria-label={`${chatUnreadCount} tin nhắn chưa đọc`}>
              {chatUnreadLabel}
            </span>
          ) : null}
        </NavLink>
      </nav>

      <div className="admin-sidebar-actions">
        <Link to="/" className="admin-nav-link">
          Về trang chủ
        </Link>
        <button
          type="button"
          className="admin-nav-link admin-action-button admin-logout-button"
          onClick={handleLogout}
        >
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
