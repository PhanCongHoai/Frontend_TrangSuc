import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  clearAuthSession,
  getAccessToken,
  getAuthHeaders,
  getCurrentUser,
  isAdminUser,
} from "../utils/auth";
import { buildApiUrl } from "../utils/api";

function ProtectedAdminRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const token = getAccessToken();
    const currentUser = getCurrentUser();

    if (!token || !isAdminUser(currentUser)) {
      clearAuthSession();
      setStatus("unauthorized");
      return;
    }

    let isMounted = true;

    const verifyAdminSession = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/auth/admin-only"), {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok || !data.success || !isAdminUser(data.user)) {
          throw new Error(data.message || "Unauthorized");
        }

        if (isMounted) {
          setStatus("authorized");
        }
      } catch (error) {
        clearAuthSession();
        if (isMounted) {
          setStatus("unauthorized");
        }
      }
    };

    verifyAdminSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "checking") {
    return <div style={{ padding: "32px" }}>Đang xác thực quyền quản trị...</div>;
  }

  if (status === "unauthorized") {
    return <Navigate to="/login" replace state={{ from: location.pathname, adminOnly: true }} />;
  }

  return children;
}

export default ProtectedAdminRoute;
