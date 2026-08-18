import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import HomePage from "./pages/home/HomePage";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ProductDetailPage from "./pages/ProductDetailPage";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import ComparePage from "./pages/ComparePage";
import OrdersPage from "./pages/OrdersPage";
import ProductsPage from "./pages/ProductsPage";
import AboutPage from "./pages/AboutPage";
import ArticlesPage from "./pages/ArticlesPage";
import ArticleDetailPage from "./pages/ArticleDetailPage";
import ReturnRequestPage from "./pages/ReturnRequestPage";
import ReturnPolicyPage from "./pages/ReturnPolicyPage";
import Admin from "./pages/admin/Admin";
import BannersPage from "./pages/admin/pages/BannersPage";
import ChatsPage from "./pages/admin/pages/ChatsPage";
import CustomersPage from "./pages/admin/pages/CustomersPage";
import CategoriesPage from "./pages/admin/pages/CategoriesPage";
import DashboardPage from "./pages/admin/pages/DashboardPage";
import GoldRatesPage from "./pages/admin/pages/GoldRatesPage";
import AdminOrdersPage from "./pages/admin/pages/OrdersPage";
import AdminProductsPage from "./pages/admin/pages/ProductsPage";
import ReportsPage from "./pages/admin/pages/ReportsPage";
import SmartReportPage from "./pages/admin/pages/SmartReportPage";
import PromotionsPage from "./pages/admin/pages/PromotionsPage";
import AdminReturnRequestsPage from "./pages/admin/pages/ReturnRequestsPage";
import ShipperSimulatorPage from "./pages/admin/pages/ShipperSimulatorPage";
import RawMaterialsPage from "./pages/admin/pages/RawMaterialsPage";
import ManufacturingPage from "./pages/admin/pages/ManufacturingPage";
import PosCheckoutPage from "./pages/admin/pages/PosCheckoutPage";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  clearAuthSession,
  getAccessToken,
  getCurrentUser,
  isStaffUser,
} from "./utils/auth";
import { buildApiUrl } from "./utils/api";

const API_BASE_URL = buildApiUrl();
const ACCOUNT_STATUS_CHECK_INTERVAL_MS = 10000;

function isBlockedAccountResponse(data, status) {
  const message = String(data?.message || "").toLowerCase();

  return (
    data?.code === "ACCOUNT_BLOCKED" ||
    (status === 403 &&
      (message.includes("blocked") ||
        message.includes("disabled") ||
        message.includes("bị chặn") ||
        message.includes("bi chan")))
  );
}

function isExpiredSessionResponse(data, status) {
  const message = String(data?.message || "").toLowerCase();

  return (
    status === 401 &&
    (data?.code === "TOKEN_EXPIRED" ||
      message.includes("token") ||
      message.includes("expired") ||
      message.includes("jwt expired") ||
      message.includes("hết hạn") ||
      message.includes("het han"))
  );
}

function AccountStatusGuard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isActive = true;
    let controller = null;

    const redirectBlockedAccount = (message = BLOCKED_ACCOUNT_MESSAGE) => {
      clearAuthSession();

      if (location.pathname !== "/login") {
        navigate("/login", {
          replace: true,
          state: {
            accountBlocked: true,
            message,
          },
        });
      }
    };

    const redirectExpiredSession = () => {
      clearAuthSession();

      if (location.pathname !== "/login") {
        navigate("/login", {
          replace: true,
          state: {
            sessionExpired: true,
            message: SESSION_EXPIRED_MESSAGE,
          },
        });
      }
    };

    const checkAccountStatus = async () => {
      const currentUser = getCurrentUser();
      const token = getAccessToken();

      if (!token && currentUser) {
        redirectExpiredSession();
        return;
      }

      if (!token || !currentUser) {
        return;
      }

      if (controller) {
        controller.abort();
      }

      controller = new AbortController();

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const rawResponse = await response.text();
        let data = null;

        try {
          data = rawResponse ? JSON.parse(rawResponse) : null;
        } catch {
          data = null;
        }

        if (!isActive) {
          return;
        }

        if (isBlockedAccountResponse(data, response.status)) {
          redirectBlockedAccount(data?.message || BLOCKED_ACCOUNT_MESSAGE);
          return;
        }

        if (isExpiredSessionResponse(data, response.status)) {
          redirectExpiredSession();
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Check account status error:", error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAccountStatus();
      }
    };

    checkAccountStatus();
    const intervalId = window.setInterval(
      checkAccountStatus,
      ACCOUNT_STATUS_CHECK_INTERVAL_MS
    );
    window.addEventListener("focus", checkAccountStatus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkAccountStatus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (controller) {
        controller.abort();
      }
    };
  }, [location.pathname, navigate]);

  return null;
}

function StaffAccessGuard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (isStaffUser(currentUser)) {
      const allowedPaths = ["/pos", "/login", "/forgot-password", "/reset-password"];
      const isAllowed = allowedPaths.some(
        (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
      );
      if (!isAllowed) {
        navigate("/pos", { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  return (
    <>
      <AccountStatusGuard />
      <StaffAccessGuard />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/returns" element={<ReturnRequestPage />} />
        <Route path="/return-policy" element={<ReturnPolicyPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/articles/:id" element={<ArticleDetailPage />} />
        <Route path="/admin" element={<Admin />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="smart-reports" element={<SmartReportPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="banners" element={<BannersPage />} />
          <Route path="gold-rates" element={<GoldRatesPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="chats" element={<ChatsPage />} />
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="return-requests" element={<AdminReturnRequestsPage />} />
          <Route path="shipper-simulator" element={<ShipperSimulatorPage />} />
          <Route path="raw-materials" element={<RawMaterialsPage />} />
          <Route path="manufacturing" element={<ManufacturingPage />} />
        </Route>
        <Route path="/pos" element={<PosCheckoutPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </>
  );
}

export default App;
